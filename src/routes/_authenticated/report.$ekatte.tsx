import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ReportInfographic } from "@/components/ReportInfographic";
import { Button } from "@/components/ui/button";
import { parseReport } from "@/lib/generate-report";
import { getMyReportByEkatte, type SavedReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/report/$ekatte")({
  head: () => ({
    meta: [{ title: "Мой доклад — Къде Да" }, { name: "robots", content: "noindex" }],
  }),
  component: MyReportPage,
});

function MyReportPage() {
  const { ekatte } = Route.useParams();
  const [report, setReport] = useState<SavedReport | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(ekatte);
    if (!Number.isInteger(id) || id <= 0) {
      setReport(null);
      return;
    }
    let active = true;
    getMyReportByEkatte({ data: { ekatte: id } })
      .then((row) => active && setReport(row))
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Неуспешно зареждане.");
        setReport(null);
      });
    return () => {
      active = false;
    };
  }, [ekatte]);

  if (report === undefined) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const payload = report ? parseReport(report.report_content) : null;

  if (!report || !payload) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Докладът не е намерен</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Нямате запазен доклад за това населено място."}
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/profil">Към моите доклади</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 sm:py-10">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/profil" className="text-sm text-muted-foreground hover:text-primary">
          ← Моите доклади
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{report.is_public ? "Публичен доклад" : "Личен доклад"}</span>
          {report.is_public && report.ekatte != null && (
            <Link
              to="/selo/$ekatte"
              params={{ ekatte: String(report.ekatte) }}
              className="text-primary underline"
            >
              Публична страница
            </Link>
          )}
        </div>
      </div>
      <ReportInfographic
        place={payload.place}
        current={payload.current ?? null}
        sections={payload.sections}
        demo={false}
        purpose={payload.purpose ?? null}
        generatedAt={payload.generatedAt ?? report.updated_at}
      />
    </main>
  );
}
