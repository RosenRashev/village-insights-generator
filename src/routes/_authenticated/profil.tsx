import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { PendingApproval } from "@/components/PendingApproval";
import { reasonLabel, signed } from "@/lib/credit-labels";
import { getMyCreditHistory } from "@/lib/credits.functions";
import {
  deleteReport,
  getMyQuota,
  listMyReports,
  type MyReportListItem,
  setReportVisibility,
} from "@/lib/reports.functions";

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const refreshCompare = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-report-places"] });
    void queryClient.invalidateQueries({ queryKey: ["my-report"] });
    void queryClient.invalidateQueries({ queryKey: ["my-report-summary"] });
  };

  // Списъкът се пази в кеша: при връщане на страницата се показва веднага, без „Зареждане…“.
  const reportsQuery = useQuery({
    queryKey: ["my-reports", user?.id],
    queryFn: () => listMyReports({ data: undefined }),
    enabled: !!user && profile?.is_approved === true,
    staleTime: 5 * 60_000,
  });
  const reports = reportsQuery.data ?? null;
  const quotaQuery = useQuery({
    queryKey: ["my-quota", user?.id],
    queryFn: () => getMyQuota({ data: undefined }),
    enabled: !!user && profile?.is_approved === true,
    staleTime: 60_000,
  });
  const quota = quotaQuery.data;
  const historyQuery = useQuery({
    queryKey: ["my-credit-history", user?.id],
    queryFn: () => getMyCreditHistory({ data: undefined }),
    enabled: !!user && profile?.is_approved === true && quota?.unlimited === false,
    staleTime: 60_000,
  });
  const history = historyQuery.data ?? [];
  const load = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-reports"] });
  };

  useEffect(() => {
    if (reportsQuery.error) {
      toast.error(
        reportsQuery.error instanceof Error ? reportsQuery.error.message : "Неуспешно зареждане.",
      );
    }
  }, [reportsQuery.error]);

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

  const toggle = async (r: MyReportListItem) => {
    setBusyId(r.id);
    try {
      await setReportVisibility({ data: { id: r.id, isPublic: !r.is_public } });
      refreshCompare();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешна промяна.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: MyReportListItem) => {
    setBusyId(r.id);
    try {
      await deleteReport({ data: { id: r.id } });
      refreshCompare();
      await load();
      toast.success("Докладът е изтрит.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно изтриване.");
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
          {quota && !quota.unlimited && (
            <p className="mt-1 text-sm">
              Оставащи нови доклади: <strong>{quota.credits}</strong>
              {quota.credits === 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  — заявете още от кутийката с доклади до профилната ви снимка горе
                </span>
              )}
            </p>
          )}
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
                  {r.ekatte != null && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/report/$ekatte"
                        params={{ ekatte: String(r.ekatte) }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Отвори
                      </Link>
                    </Button>
                  )}
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
            </div>
          );
        })}
      </div>
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">История на докладите</h2>
          <ul className="mt-3 divide-y rounded-md border">
            {history.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block">{reasonLabel(t.reason)}</span>
                  {t.place && (
                    <span className="block truncate text-xs text-muted-foreground">{t.place}</span>
                  )}
                  <span className="block text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("bg-BG")}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className={t.delta > 0 ? "font-semibold text-primary" : "font-semibold"}>
                    {signed(t.delta)}
                  </span>
                  {t.balance_after !== null && (
                    <span className="block text-[11px] text-muted-foreground">
                      остават {t.balance_after}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
