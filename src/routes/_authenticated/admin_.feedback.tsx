import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmButton } from "@/components/ConfirmButton";
import { FullPageLoading, LoadFailed } from "@/components/LoadFailed";
import { useAuth } from "@/hooks/useAuth";
import { toUserMessage } from "@/lib/user-errors";
import { deleteFeedback, listFeedback, type FeedbackRow } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin_/feedback")({
  head: () => ({
    meta: [{ title: "Обратна връзка — Къде Да" }, { name: "robots", content: "noindex" }],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { profile, loading, profileError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) void navigate({ to: "/" });
  }, [loading, profile, navigate]);

  const load = async () => {
    try {
      setRows(await listFeedback({ data: undefined }));
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

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteFeedback({ data: { id } });
      await load();
    } catch (err) {
      toast.error(toUserMessage(err, "Неуспешно изтриване."));
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Обратна връзка</h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary">
          ← Регистрации
        </Link>
      </div>

      {!rows && !loadFailed && <p className="mt-8 text-sm text-muted-foreground">Зареждане…</p>}
      {!rows && loadFailed && <LoadFailed onRetry={() => void load()} />}
      {rows && rows.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Още няма получени съобщения.</p>
      )}

      <div className="mt-8 space-y-3">
        {rows?.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-4">
            <p className="whitespace-pre-wrap break-words text-sm">{r.message}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("bg-BG")}
              </p>
              <ConfirmButton
                size="sm"
                variant="ghost"
                disabled={busyId !== null}
                ariaLabel="Изтрий съобщението"
                title="Да изтрия ли съобщението?"
                description="Съобщението ще бъде изтрито завинаги."
                confirmLabel="Изтрий"
                onConfirm={() => remove(r.id)}
              >
                <Trash2 className="h-4 w-4" />
              </ConfirmButton>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
