import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ReportInfographic } from "@/components/ReportInfographic";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { parseReport } from "@/lib/generate-report";
import { getPublicReportByEkatte, type PublicReport } from "@/lib/public-reports.functions";
import { getMyReportByEkatte, type SavedReport } from "@/lib/reports.functions";
import { displaySettlement } from "@/lib/settlements";

/**
 * Единен адрес на доклад: /report/<ЕКАТТЕ>. Докладите се виждат само от влезли потребители.
 * Влезлият вижда собствения си доклад за мястото (ако има такъв — публичен или личен, с личната
 * му локация и цел), иначе най-новия публичен доклад. Сървърът не изпраща съдържание на доклад
 * на гости; зарежда се в браузъра след вход.
 */
export const Route = createFileRoute("/report/$ekatte")({
  loader: async ({ params }) => {
    const ekatte = Number(params.ekatte);
    if (!Number.isInteger(ekatte) || ekatte <= 0) throw notFound();

    const { loadSettlements } = await import("@/lib/settlements");
    const place = (await loadSettlements()).find((s) => s.ekatte === ekatte);
    return { ekatte, placeLabel: place ? displaySettlement(place) : "" };
  },
  head: ({ loaderData }) => {
    const label = loaderData?.placeLabel;
    return {
      meta: [
        { title: label ? `${label} — доклад | Къде Да` : "Доклад — Къде Да" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ReportPage,
});

function ReportPage() {
  const { ekatte, placeLabel } = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();

  // Доклади: собственият на потребителя и най-новият публичен. undefined = още се зарежда.
  const [own, setOwn] = useState<SavedReport | null | undefined>(undefined);
  const [publicRow, setPublicRow] = useState<PublicReport | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    setOwn(undefined);
    setPublicRow(undefined);
    getMyReportByEkatte({ data: { ekatte } })
      .then((r) => active && setOwn(r))
      .catch(() => active && setOwn(null));
    getPublicReportByEkatte({ data: { ekatte } })
      .then((r) => active && setPublicRow(r))
      .catch(() => active && setPublicRow(null));
    return () => {
      active = false;
    };
  }, [authLoading, user, ekatte]);

  // Тежката инфографика (графики, карта) се рисува само в браузъра.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shown = own ?? publicRow ?? null;
  const payload = shown ? parseReport(shown.report_content) : null;
  const label = payload?.place ? displaySettlement(payload.place) : placeLabel;

  if (authLoading || (user && (own === undefined || publicRow === undefined))) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{placeLabel || "Доклад за населено място"}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Докладите са достъпни само за регистрирани потребители. Влезте в профила си или се
          регистрирайте, за да видите този доклад.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/vhod">Вход / Регистрация</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Към началната страница</Link>
          </Button>
        </div>
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

  return (
    <main className="px-4 py-6 sm:py-8">
      {mounted && (
        <div>
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
    </main>
  );
}
