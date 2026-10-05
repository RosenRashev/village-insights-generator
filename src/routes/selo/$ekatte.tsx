import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link2, Scale, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ReportInfographic } from "@/components/ReportInfographic";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/lib/favorites";
import { parseReport } from "@/lib/generate-report";
import { getPublicReportByEkatte } from "@/lib/public-reports.functions";
import { displaySettlement } from "@/lib/settlements";

const SITE = "https://kadeda.eu";

export const Route = createFileRoute("/selo/$ekatte")({
  loader: async ({ params }) => {
    const ekatte = Number(params.ekatte);
    if (!Number.isInteger(ekatte) || ekatte <= 0) throw notFound();

    const row = await getPublicReportByEkatte({ data: { ekatte } });
    const payload = row ? parseReport(row.report_content) : null;
    if (!row || !payload) throw notFound();

    return {
      ekatte,
      row,
      placeLabel: payload.place ? displaySettlement(payload.place) : (row.place_name ?? ""),
    };
  },
  head: ({ loaderData, params }) => {
    const label = loaderData?.placeLabel ?? "населено място";
    const title = `${label} — доклад за живеене и имот | Къде Да`;
    const description = `Подробен доклад за ${label}: инфраструктура, ВиК, транспорт, сигурност, демография, услуги, интернет и още — на едно място.`;
    const url = `${SITE}/selo/${params.ekatte}`;
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
  component: PlaceReportPage,
});

function PlaceReportPage() {
  const { ekatte, row, placeLabel } = Route.useLoaderData();
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(ekatte);
  const payload = parseReport(row.report_content);
  // Тежката инфографика (графики, карта) се рисува само в браузъра; сървърът изпраща
  // заглавието и списъка с темите, които са достатъчни за индексиране.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Връзката е копирана.");
    } catch {
      toast.error("Връзката не можа да бъде копирана.");
    }
  };

  if (!payload) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="text-center print:hidden">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{placeLabel}</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Доклад за инфраструктурата, услугите и средата в населеното място — за хора, които
          обмислят да живеят там или да купят имот.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
            <Link2 className="h-4 w-4" />
            Копирай връзката
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggle({ ekatte, label: placeLabel })}
            aria-pressed={favorite}
          >
            <Star className={`h-4 w-4 ${favorite ? "fill-amber-400 text-amber-500" : ""}`} />
            {favorite ? "В любими" : "Добави в любими"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/sravnenie" search={{ m: String(ekatte) }}>
              <Scale className="h-4 w-4" />
              Сравни
            </Link>
          </Button>
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
            sections={payload.sections}
            demo={false}
            generatedAt={payload.generatedAt ?? row.updated_at}
          />
        </div>
      )}

      {!user && (
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
