import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { PendingApproval } from "@/components/PendingApproval";
import { ReportInfographic } from "@/components/ReportInfographic";
import {
  deleteReport,
  listMyReports,
  setReportVisibility,
  updateReportContent,
  type SavedReport,
} from "@/lib/reports.functions";
import { generateReportSections, parseReport, serializeReport } from "@/lib/generate-report";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Моите доклади — Къде Да" },
      { name: "description", content: "Вашите генерирани доклади за населени места в Къде Да." },
      { property: "og:title", content: "Моите доклади — Къде Да" },
      { property: "og:description", content: "Вашите генерирани доклади за населени места." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, loading, user, signOut } = useAuth();
  const [reports, setReports] = useState<SavedReport[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    try {
      setReports(await listMyReports({ data: undefined }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно зареждане.");
    }
  };

  useEffect(() => {
    if (profile?.is_approved) void load();
  }, [profile?.is_approved]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (profile && !profile.is_approved) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <PendingApproval />
      </main>
    );
  }

  const toggle = async (r: SavedReport) => {
    setBusyId(r.id);
    try {
      await setReportVisibility({ data: { id: r.id, isPublic: !r.is_public } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешна промяна.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: SavedReport) => {
    setBusyId(r.id);
    try {
      await deleteReport({ data: { id: r.id } });
      await load();
      toast.success("Докладът е изтрит.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно изтриване.");
    } finally {
      setBusyId(null);
    }
  };

  const regenerate = async (r: SavedReport) => {
    const payload = parseReport(r.report_content);
    if (!payload) {
      toast.error("Този доклад не може да се регенерира автоматично.");
      return;
    }
    setBusyId(r.id);
    try {
      const { sections } = await generateReportSections({
        place: payload.place,
        current: payload.current ?? null,
        purpose: payload.purpose ?? null,
      });
      await updateReportContent({
        data: { id: r.id, reportContent: serializeReport({ ...payload, sections }) },
      });
      await load();
      toast.success("Докладът е обновен.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно регенериране.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Моите доклади</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          Изход
        </Button>
      </div>

      {!reports && <p className="mt-8 text-sm text-muted-foreground">Зареждане…</p>}
      {reports && reports.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Още нямате генерирани доклади.</p>
      )}

      <div className="mt-8 space-y-4">
        {reports?.map((r) => {
          const payload = parseReport(r.report_content);
          return (
            <div key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.place_name ?? r.location_query}</p>
                  <p className="text-xs text-muted-foreground">
                    Обновен: {new Date(r.updated_at).toLocaleDateString("bg-BG")} ·{" "}
                    {r.is_public ? "публичен" : "личен"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => void toggle(r)}
                  >
                    {r.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {r.is_public ? "Направи личен" : "Направи публичен"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => void regenerate(r)}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Регенерирай
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenId((id) => (id === r.id ? null : r.id))}
                  >
                    {openId === r.id ? "Скрий" : "Виж"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === r.id}
                    onClick={() => void remove(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {openId === r.id && payload && (
                <div className="mt-6">
                  <ReportInfographic
                    place={payload.place}
                    current={payload.current ?? null}
                    sections={payload.sections}
                    demo={false}
                    purpose={payload.purpose ?? null}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
