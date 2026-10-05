import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, X } from "lucide-react";

import { SettlementCombobox } from "@/components/SettlementCombobox";
import { Button } from "@/components/ui/button";
import { buildComparison, type CompareLevel, type ComparePlace } from "@/lib/compare";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/lib/favorites";
import { parseReport } from "@/lib/generate-report";
import {
  getPublicReportByEkatte,
  listPublicPlaces,
  type PublicPlace,
} from "@/lib/public-reports.functions";
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

const LEVEL_STYLE: Record<CompareLevel, string> = {
  good: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  fair: "bg-amber-50 text-amber-900 ring-amber-200",
  poor: "bg-rose-50 text-rose-900 ring-rose-200",
};

type Loaded = { ekatte: number; place: ComparePlace | null };

function ComparePage() {
  const { m } = Route.useSearch();
  const navigate = useNavigate();
  const ids = useMemo(() => parseEkatte(m), [m]);
  const { favorites, remove, isFavorite, toggle } = useFavorites();
  const { user, loading: authLoading } = useAuth();

  const [publicPlaces, setPublicPlaces] = useState<PublicPlace[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listPublicPlaces()
      .then((rows) => active && setPublicPlaces(rows))
      .catch(() => active && setPublicPlaces([]));
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user || ids.length === 0) {
      setLoaded([]);
      return;
    }
    setLoading(true);
    Promise.all(
      ids.map(async (ekatte): Promise<Loaded> => {
        try {
          const row = await getPublicReportByEkatte({ data: { ekatte } });
          const payload = row ? parseReport(row.report_content) : null;
          if (!row || !payload) return { ekatte, place: null };
          return {
            ekatte,
            place: {
              label: payload.place ? displaySettlement(payload.place) : (row.place_name ?? ""),
              place: payload.place,
              sections: payload.sections,
            },
          };
        } catch {
          return { ekatte, place: null };
        }
      }),
    )
      .then((rows) => active && setLoaded(rows))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ids, user]);

  const setIds = (next: number[]) =>
    void navigate({
      to: "/sravnenie",
      search: next.length > 0 ? { m: next.join(",") } : {},
      replace: true,
    });

  const add = (s: Settlement) => {
    if (ids.length < MAX_PLACES && !ids.includes(s.ekatte)) setIds([...ids, s.ekatte]);
    setPickerKey((k) => k + 1);
  };

  const available = loaded.filter((l): l is { ekatte: number; place: ComparePlace } => !!l.place);
  const missing = loaded.filter((l) => !l.place);
  const rows = useMemo(() => buildComparison(available.map((l) => l.place)), [available]);

  const addableFavorites = favorites.filter(
    (f) =>
      !ids.includes(f.ekatte) &&
      (publicPlaces === null || publicPlaces.some((p) => p.ekatte === f.ekatte)),
  );

  let lastGroup = "";

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
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Сравнение на места</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Изберете до {MAX_PLACES} населени места с вече генериран доклад и вижте най-важните им
          показатели един до друг. Данните са от докладите — без нови заявки и разходи.
        </p>
      </header>

      <section className="mx-auto mt-8 max-w-xl space-y-4">
        {ids.length < MAX_PLACES && (
          <SettlementCombobox
            key={pickerKey}
            id="compare-place"
            label="Добавете населено място"
            placeholder="напр. Баня"
            value={null}
            onChange={(s) => s && add(s)}
            excludeLargeCities
            allowedEkatte={publicPlaces?.map((p) => p.ekatte) ?? []}
          />
        )}

        {addableFavorites.length > 0 && ids.length < MAX_PLACES && (
          <div>
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
        {favorites.length === 0 && ids.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Съвет: отворете доклад за населено място и натиснете „Добави в любими“, за да го
            намирате бързо тук.
          </p>
        )}
      </section>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {missing.length > 0 && !loading && (
        <p className="mt-6 text-center text-sm text-destructive">
          За някои от избраните места няма публичен доклад и те са пропуснати.
        </p>
      )}

      {available.length > 0 && !loading && (
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 w-44 bg-card px-4 py-3 text-left font-medium text-muted-foreground">
                  &nbsp;
                </th>
                {available.map((l) => (
                  <th key={l.ekatte} className="px-4 py-3 text-left align-top">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/report/$ekatte"
                        params={{ ekatte: String(l.ekatte) }}
                        className="font-semibold text-primary hover:underline"
                      >
                        {l.place.label}
                      </Link>
                      <button
                        type="button"
                        aria-label={isFavorite(l.ekatte) ? "Махни от любимите" : "Добави в любими"}
                        title={isFavorite(l.ekatte) ? "В любими" : "Добави в любими"}
                        className="ml-auto text-muted-foreground hover:text-amber-500"
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
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const header = row.group !== lastGroup;
                lastGroup = row.group;
                return [
                  header && (
                    <tr key={`g-${row.group}`} className="bg-muted/50">
                      <td
                        colSpan={available.length + 1}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                      >
                        {row.group}
                      </td>
                    </tr>
                  ),
                  <tr key={`${row.group}-${row.label}`} className="border-t border-border/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium text-foreground"
                    >
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="px-4 py-2.5 align-top">
                        {cell ? (
                          <span
                            className={
                              cell.level
                                ? `inline-block rounded-md px-2 py-0.5 ring-1 ${LEVEL_STYLE[cell.level]}`
                                : ""
                            }
                          >
                            {cell.text}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
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
