import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link2, Loader2, Scale, Star } from "lucide-react";
import { toast } from "sonner";

import { ReportInfographic } from "@/components/ReportInfographic";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/lib/favorites";
import { parseReport } from "@/lib/generate-report";
import { getPublicReportByEkatte } from "@/lib/public-reports.functions";
import { getMyReportByEkatte, type SavedReport } from "@/lib/reports.functions";
import { displaySettlement } from "@/lib/settlements";

const SITE = "https://kadeda.eu";

/**
 * Единен адрес на доклад: /report/<ЕКАТТЕ>.
 * Всички виждат публичния доклад за мястото; влезлият потребител, който има собствен доклад
 * за същото място (публичен или личен), вижда своя — с личната си локация и цел, ако ги е задал.
 */
export const Route = createFileRoute("/report/$ekatte")({
  loader: async ({ params }) => {
    const ekatte = Number(params.ekatte);
    if (!Number.isInteger(ekatte) || ekatte <= 0) throw notFound();

    const row = await getPublicReportByEkatte({ data: { ekatte } });
    const payload = row ? parseReport(row.report_content) : null;
    return {
      ekatte,
      row: payload ? row : null,
      placeLabel: payload?.place ? displaySettlement(payload.place) : (row?.place_name ?? ""),
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.row) {
      return { meta: [{ title: "Доклад — Къде Да" }, { name: "robots", content: "noindex" }] };
    }
    const label = loaderData.placeLabel || "населено място";
    const title = `${label} — доклад за живеене и имот | Къде Да`;
    const description = `Подробен доклад за ${label}: инфраструктура, ВиК, транспорт, сигурност, демография, услуги, интернет и още — на едно място.`;
    const url = `${SITE}/report/${params.ekatte}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ReportPage,
});

function ReportPage() {
  const { ekatte, row: publicRow, placeLabel } = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(ekatte);

  // Собственият доклад на влезлия потребител (ако има такъв). undefined = още се проверява.
  const [own, setOwn] = useState<SavedReport | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setOwn(null);
      return;
    }
    let active = true;
    getMyReportByEkatte({ data: { ekatte } })
      .then((r) => active && setOwn(r))
      .catch(() => active && setOwn(null));
    return () => {
      active = false;
    };
  }, [authLoading, user, ekatte]);

  // Тежката инфографика (графики, карта) се рисува само в браузъра; сървърът изпраща
  // заглавието и списъка с темите, които са достатъчни за индексиране.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shown = own ?? publicRow;
  const payload = shown ? parseReport(shown.report_content) : null;
  const label = payload?.place ? displaySettlement(payload.place) : placeLabel;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/report/${ekatte}`);
      toast.success("Връзката е копирана.");
    } catch {
      toast.error("Връзката не можа да бъде копирана.");
    }
  };

  if (own === undefined && !publicRow) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Докладът не е намерен</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          За това населено място още няма публичен доклад.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">Към началната страница</Link>
        </Button>
      </main>
    );
  }

  const hasPublic = publicRow !== null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="text-center print:hidden">
        {own && (
          <p className="mb-3 text-sm text-muted-foreground">
            <Link to="/profil" className="text-primary hover:underline">
              ← Моите доклади
            </Link>
            {" · "}
            {own.is_public ? "Вашият публичен доклад" : "Личен доклад — вижда се само от вас"}
          </p>
        )}
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{label}</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Доклад за инфраструктурата, услугите и средата в населеното място — за хора, които
          обмислят да живеят там или да купят имот.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {user && (hasPublic || own?.is_public) && (
            <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
              <Link2 className="h-4 w-4" />
              Копирай връзката
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggle({ ekatte, label })}
            aria-pressed={favorite}
          >
            <Star className={`h-4 w-4 ${favorite ? "fill-amber-400 text-amber-500" : ""}`} />
            {favorite ? "В любими" : "Добави в любими"}
          </Button>
          {(hasPublic || own?.is_public) && (
            <Button asChild variant="outline" size="sm">
              <Link to="/sravnenie" search={{ m: String(ekatte) }}>
                <Scale className="h-4 w-4" />
                Сравни
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/">Търси друго населено място</Link>
          </Button>
        </div>
      </header>

      <section className="mt-8 print:hidden">
        <h2 className="sr-only">Теми в доклада</h2>
        <ul className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          {payload.sections
            .filter((s) => s.id !== "onsite-checklist")
            .map((s) => (
              <li key={s.id} className="rounded-full border border-border px-3 py-1">
                {s.title}
              </li>
            ))}
        </ul>
      </section>

      {mounted && (
        <div className="mt-8">
          <ReportInfographic
            place={payload.place}
            current={own ? (payload.current ?? null) : null}
            sections={payload.sections}
            demo={false}
            purpose={own ? (payload.purpose ?? null) : null}
            generatedAt={payload.generatedAt ?? shown?.updated_at}
          />
        </div>
      )}

      {!user && !authLoading && (
        <p className="mt-10 rounded-lg border border-border bg-card/70 p-4 text-center text-sm text-muted-foreground print:hidden">
          Искате доклад за друго населено място?{" "}
          <Link to="/vhod" className="font-medium text-primary underline">
            Регистрирайте се
          </Link>
          .
        </p>
      )}
    </main>
  );
}
