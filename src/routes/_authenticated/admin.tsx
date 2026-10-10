import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

import { ConfirmButton } from "@/components/ConfirmButton";
import { FullPageLoading, LoadFailed } from "@/components/LoadFailed";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { reportsWord } from "@/lib/credits-notice";
import { toUserMessage } from "@/lib/user-errors";
import {
  listProfiles,
  resolveCreditRequest,
  setProfileApproval,
  setReportCredits,
  type AdminProfile,
} from "@/lib/admin.functions";

/** Claude артефакт за ръчното проучване на градове (промпт, инструкции, запис на отговорите). */
const DOSSIERS_URL = "https://claude.ai/artifact/75h7a4wuh9md9Ekie4nZaq";

/** Цвят на реда: жълто — чака зареждане; зелено — има доклади; сиво — няма. */
function rowTone(r: AdminProfile): string {
  if (r.is_admin) return "border-border";
  if (r.pendingRequest) return "border-amber-400/70 bg-amber-500/10";
  if (r.credits > 0) return "border-emerald-400/60 bg-emerald-500/10";
  return "border-border bg-muted/40";
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Админ — Къде Да" },
      { name: "description", content: "Управление на регистрациите в Къде Да." },
      { property: "og:title", content: "Админ — Къде Да" },
      { property: "og:description", content: "Управление на регистрациите." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { profile, loading, profileError, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminProfile[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) void navigate({ to: "/" });
  }, [loading, profile, navigate]);

  const load = async () => {
    try {
      setRows(await listProfiles({ data: undefined }));
      setLoadFailed(false);
    } catch (err) {
      setLoadFailed(true);
      toast.error(toUserMessage(err, "Неуспешно зареждане."));
    }
  };

  useEffect(() => {
    if (profile?.is_admin) void load();
  }, [profile?.is_admin]);

  if (loading || !profile?.is_admin) {
    return (
      <FullPageLoading
        profileError={profileError && !profile}
        onRetry={() => void refreshProfile()}
      />
    );
  }

  const addCredits = async (id: string, add: number) => {
    setBusyId(id);
    try {
      await setReportCredits({ data: { id, add } });
      await load();
    } catch (err) {
      toast.error(toUserMessage(err, "Неуспешна промяна."));
    } finally {
      setBusyId(null);
    }
  };

  const resolveRequest = async (profileId: string, requestId: string, approve: boolean) => {
    setBusyId(profileId);
    try {
      const res = await resolveCreditRequest({ data: { id: requestId, approve } });
      await load();
      toast.success(approve ? `Заредени са ${reportsWord(res.amount)}.` : "Заявката е отказана.");
    } catch (err) {
      toast.error(toUserMessage(err, "Неуспешна промяна."));
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (id: string, approved: boolean) => {
    setBusyId(id);
    try {
      await setProfileApproval({ data: { id, approved } });
      await load();
      toast.success(approved ? "Достъпът е одобрен." : "Достъпът е отказан.");
    } catch (err) {
      toast.error(toUserMessage(err, "Неуспешна промяна."));
    } finally {
      setBusyId(null);
    }
  };

  const pending = rows?.filter((r) => !r.is_approved) ?? [];
  const approved = rows?.filter((r) => r.is_approved) ?? [];
  const pendingRequests = approved.filter((r) => r.pendingRequest !== null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Регистрации</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a
            href={DOSSIERS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary"
          >
            Градски досиета ↗
          </a>
          <Link to="/admin/reports" className="text-muted-foreground hover:text-primary">
            Доклади
          </Link>
          <Link to="/admin/import" className="text-muted-foreground hover:text-primary">
            Импорт на проучване
          </Link>
          <Link to="/admin/feedback" className="text-muted-foreground hover:text-primary">
            Обратна връзка →
          </Link>
        </div>
      </div>

      {rows === null && !loadFailed && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Зареждане…
        </p>
      )}
      {rows === null && loadFailed && <LoadFailed onRetry={() => void load()} />}

      {rows !== null && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Чакащи одобрение ({pending.length})</h2>
            <div className="mt-3 space-y-2">
              {pending.length === 0 && (
                <p className="text-sm text-muted-foreground">Няма чакащи.</p>
              )}
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{r.email ?? r.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("bg-BG")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, true)}
                    >
                      <Check className="h-4 w-4" />
                      Одобри
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, false)}
                    >
                      <X className="h-4 w-4" />
                      Откажи
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-semibold">
              Одобрени ({approved.length})
              {pendingRequests.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Чакащи заявки за доклади: {pendingRequests.length}
                </span>
              )}
            </h2>
            <div className="mt-3 space-y-2">
              {approved.map((r) => (
                <div
                  key={r.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${rowTone(r)}`}
                >
                  <div className="text-sm">
                    <p>
                      <Link
                        to="/admin/users/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {r.email ?? r.id}
                      </Link>
                      {r.is_admin && <span className="ml-2 text-xs text-primary">админ</span>}
                    </p>
                    {r.pendingRequest && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          Иска {r.pendingRequest.amount}{" "}
                          {r.pendingRequest.amount === 1 ? "доклад" : "доклада"}
                        </span>
                        <Button
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => void resolveRequest(r.id, r.pendingRequest!.id, true)}
                        >
                          Одобри +{r.pendingRequest.amount}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === r.id}
                          onClick={() => void resolveRequest(r.id, r.pendingRequest!.id, false)}
                        >
                          Откажи
                        </Button>
                        {r.pendingRequest.note && (
                          <span className="basis-full text-xs text-muted-foreground">
                            „{r.pendingRequest.note}“
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.is_admin ? (
                      <span className="text-xs text-muted-foreground">без ограничения</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm">
                          Доклади: <strong>{r.credits}</strong>
                        </span>
                        {[1, 2, 5].map((n) => (
                          <Button
                            key={n}
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.id}
                            onClick={() => void addCredits(r.id, n)}
                          >
                            +{n}
                          </Button>
                        ))}
                        <ConfirmButton
                          size="sm"
                          variant="ghost"
                          disabled={busyId === r.id || r.credits === 0}
                          title="Да нулирам ли докладите?"
                          description={`На ${r.email ?? "потребителя"} ще бъдат премахнати всички ${r.credits} налични доклада.`}
                          confirmLabel="Нулирай"
                          onConfirm={() => addCredits(r.id, -r.credits)}
                        >
                          Нулирай
                        </ConfirmButton>
                      </span>
                    )}
                    {r.id !== user?.id && (
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        title="Да отнема ли достъпа?"
                        description={`${r.email ?? "Потребителят"} няма да може да генерира и да вижда доклади, докато не бъде одобрен отново.`}
                        confirmLabel="Отнеми достъпа"
                        onConfirm={() => decide(r.id, false)}
                      >
                        Отнеми достъпа
                      </ConfirmButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
