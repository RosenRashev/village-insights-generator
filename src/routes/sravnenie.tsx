import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, X } from "lucide-react";

import { SettlementCombobox } from "@/components/SettlementCombobox";
import { Button } from "@/components/ui/button";
import { CompareTable } from "@/components/CompareTable";
import { buildComparison, buildPurposeComparison, type ComparePlace } from "@/lib/compare";
import { canUsePurpose } from "@/lib/plans";
import { PURPOSE_OPTIONS, type PurposeId } from "@/lib/purposes";
import { useAuth } from "@/hooks/useAuth";
import { loadSelection, saveSelection } from "@/lib/compare-selection";
import { useFavorites } from "@/lib/favorites";
import { parseReport } from "@/lib/generate-report";
import { getMyReportByEkatte, listMyReportPlaces } from "@/lib/reports.functions";
import { displaySettlement, type Settlement } from "@/lib/settlements";

const MAX_PLACES = 3;

const TITLE = "Сравнение на населени места — Къде Да";
const DESCRIPTION =
  "Сравнете до три села или малки града един до друг: ВиК, транспорт, рискове, интернет и още — от вече генерирани доклади.";

export const Route = createFileRoute("/sravnenie")({
  validateSearch: (search: Record<string, unknown>): { m?: string } =>
    typeof search["m"] === "string" && search["m"] ? { m: search["m"] } : {},
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://kadeda.eu/sravnenie" }],
  }),
  component: ComparePage,
});

function parseEkatte(m: string | undefined): number[] {
  const out: number[] = [];
  for (const part of (m ?? "").split(",")) {
    const n = Number(part);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out.slice(0, MAX_PLACES);
}

type Loaded = { ekatte: number; place: ComparePlace | null };

function ComparePage() {
  const { m } = Route.useSearch();
  const navigate = useNavigate();
  const ids = useMemo(() => parseEkatte(m), [m]);
  const { favorites, remove, isFavorite, toggle } = useFavorites();
  const { user, profile, loading: authLoading } = useAuth();
  const purposeAllowed = canUsePurpose(profile);
  const [purpose, setPurpose] = useState<PurposeId | null>(null);

  const [pickerKey, setPickerKey] = useState(0);

  // Заредените данни се пазят в кеша на приложението: при връщане на страницата няма
  // повторно зареждане и въртящ се индикатор (опреснява се на 5 мин. или при нов/променен доклад).
  const STALE = 5 * 60_000;
  const placesQuery = useQuery({
    queryKey: ["my-report-places", user?.id],
    queryFn: () => listMyReportPlaces(),
    enabled: !!user,
    staleTime: STALE,
  });
  const myPlaces = placesQuery.isError ? [] : (placesQuery.data ?? null);

  const reportQueries = useQueries({
    queries: ids.map((ekatte) => ({
      queryKey: ["my-report", user?.id, ekatte],
      enabled: !!user,
      staleTime: STALE,
      queryFn: async (): Promise<ComparePlace | null> => {
        const row = await getMyReportByEkatte({ data: { ekatte } });
        const payload = row ? parseReport(row.report_content) : null;
        if (!row || !payload) return null;
        return {
          label: payload.place ? displaySettlement(payload.place) : (row.place_name ?? ""),
          place: payload.place,
          sections: payload.sections,
        };
      },
    })),
  });
  const loaded: Loaded[] = ids.map((ekatte, i) => ({
    ekatte,
    place: reportQueries[i]?.data ?? null,
  }));
  const loading = reportQueries.some((q) => q.isPending && q.fetchStatus !== "idle");

  // Избраните места се възстановяват, ако страницата е отворена без избор (напр. от менюто).
  useEffect(() => {
    if (!user || m) return;
    const saved = loadSelection();
    if (saved.length > 0) {
      void navigate({ to: "/sravnenie", search: { m: saved.join(",") }, replace: true });
    }
    // само при първо отваряне
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (ids.length > 0) saveSelection(ids);
  }, [ids]);

  const setIds = (next: number[]) => {
    saveSelection(next);
    void navigate({
      to: "/sravnenie",
      search: next.length > 0 ? { m: next.join(",") } : {},
      replace: true,
    });
  };

  const add = (s: Settlement) => {
    if (ids.length < MAX_PLACES && !ids.includes(s.ekatte)) setIds([...ids, s.ekatte]);
    setPickerKey((k) => k + 1);
  };

  const available = loaded.filter((l): l is { ekatte: number; place: ComparePlace } => !!l.place);
  const missing = loaded.filter((l) => !l.place);
  const groups = useMemo(() => {
    const places = available.map((l) => l.place);
    const base = buildComparison(places);
    const label = PURPOSE_OPTIONS.find((p) => p.id === purpose)?.label;
    return purposeAllowed && purpose && label
      ? [buildPurposeComparison(places, purpose, label), ...base]
      : base;
  }, [available, purpose, purposeAllowed]);

  const addableFavorites = favorites.filter(
    (f) =>
      !ids.includes(f.ekatte) && (myPlaces === null || myPlaces.some((p) => p.ekatte === f.ekatte)),
  );

  if (!authLoading && !user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Сравнение на места</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Сравнението е достъпно само за регистрирани потребители. Влезте в профила си или се
          регистрирайте, за да сравнявате населени места.
        </p>
        <Button asChild className="mt-6">
          <Link to="/vhod">Вход / Регистрация</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Сравнение на места</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Изберете до {MAX_PLACES} населени места от вашите генерирани доклади и вижте най-важните
          им показатели един до друг. Данните са от докладите — без нови заявки и разходи.
        </p>
      </header>

      <section className="mt-8 space-y-4">
        {myPlaces !== null && myPlaces.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Още нямате генерирани доклади. Генерирайте доклад от{" "}
            <Link to="/" className="font-medium text-primary underline">
              началната страница
            </Link>
            , за да можете да сравнявате.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: MAX_PLACES }, (_, i) => {
              const ekatte = ids[i];
              if (ekatte !== undefined) {
                const known =
                  available.find((l) => l.ekatte === ekatte)?.place.label ??
                  myPlaces?.find((p) => p.ekatte === ekatte)?.placeName ??
                  `ЕКАТТЕ ${ekatte}`;
                return (
                  <div key={`slot-${i}`} className="space-y-2">
                    <p className="text-sm font-medium">Място {i + 1}</p>
                    <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={known}>
                        {known}
                      </span>
                      <button
                        type="button"
                        aria-label="Махни от сравнението"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setIds(ids.filter((id) => id !== ekatte))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <SettlementCombobox
                  key={`slot-${i}-${pickerKey}`}
                  id={`compare-place-${i}`}
                  label={`Място ${i + 1}`}
                  placeholder="Въведете място"
                  value={null}
                  onChange={(s) => s && add(s)}
                  size="sm"
                  allowedEkatte={(myPlaces ?? [])
                    .map((p) => p.ekatte)
                    .filter((id) => !ids.includes(id))}
                />
              );
            })}
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Можете да сравнявате само места, за които вече сте генерирали доклад в акаунта си.
        </p>

        {addableFavorites.length > 0 && ids.length < MAX_PLACES && (
          <div className="mx-auto max-w-xl">
            <p className="text-sm font-medium text-foreground">Любими</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {addableFavorites.map((f) => (
                <li
                  key={f.ekatte}
                  className="flex items-center overflow-hidden rounded-full border border-border text-xs"
                >
                  <button
                    type="button"
                    className="px-3 py-1.5 hover:bg-primary/10"
                    onClick={() => setIds([...ids, f.ekatte])}
                  >
                    <Star className="mr-1 inline h-3 w-3 fill-amber-400 text-amber-500" />
                    {f.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`Махни ${f.label} от любимите`}
                    className="border-l border-border px-2 py-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(f.ekatte)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {missing.length > 0 && !loading && (
        <p className="mt-6 text-center text-sm text-destructive">
          За някои от избраните места не е намерен ваш доклад и те са пропуснати.
        </p>
      )}

      {available.length > 0 && !loading && (
        <div className="mt-10">
          {purposeAllowed && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="compare-purpose" className="font-medium">
                Цел на сравнението:
              </label>
              <select
                id="compare-purpose"
                value={purpose ?? ""}
                onChange={(e) => setPurpose((e.target.value || null) as PurposeId | null)}
                className="rounded-lg border border-input bg-background px-2 py-1.5"
              >
                <option value="">Без цел</option>
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                Оценката се смята от вече запазените доклади, независимо с каква цел са генерирани.
              </span>
            </div>
          )}
          <CompareTable
            groups={groups}
            columns={available.length}
            header={
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-3 py-3 text-left font-medium text-muted-foreground">
                  &nbsp;
                </th>
                {available.map((l) => (
                  <th key={l.ekatte} className="px-3 py-3 text-left align-top">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/report/$ekatte"
                        params={{ ekatte: String(l.ekatte) }}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {l.place.label}
                      </Link>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={
                            isFavorite(l.ekatte) ? "Махни от любимите" : "Добави в любими"
                          }
                          title={isFavorite(l.ekatte) ? "В любими" : "Добави в любими"}
                          className="text-muted-foreground hover:text-amber-500"
                          onClick={() => toggle({ ekatte: l.ekatte, label: l.place.label })}
                        >
                          <Star
                            className={`h-4 w-4 ${isFavorite(l.ekatte) ? "fill-amber-400 text-amber-500" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          aria-label="Махни от сравнението"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setIds(ids.filter((id) => id !== l.ekatte))}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            }
          />
        </div>
      )}

      {available.length === 1 && !loading && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Добавете още едно място, за да започне сравнението.
        </p>
      )}

      {ids.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setIds([])}>
            Изчисти
          </Button>
        </div>
      )}
    </main>
  );
}
