import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listProfiles, setProfileApproval, type AdminProfile } from "@/lib/admin.functions";

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
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminProfile[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) void navigate({ to: "/" });
  }, [loading, profile, navigate]);

  const load = async () => {
    try {
      setRows(await listProfiles({ data: undefined }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно зареждане.");
    }
  };

  useEffect(() => {
    if (profile?.is_admin) void load();
  }, [profile?.is_admin]);

  if (loading || !profile?.is_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const decide = async (id: string, approved: boolean) => {
    setBusyId(id);
    try {
      await setProfileApproval({ data: { id, approved } });
      await load();
      toast.success(approved ? "Достъпът е одобрен." : "Достъпът е отказан.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешна промяна.");
    } finally {
      setBusyId(null);
    }
  };

  const pending = rows?.filter((r) => !r.is_approved) ?? [];
  const approved = rows?.filter((r) => r.is_approved) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-primary">Регистрации</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Чакащи одобрение ({pending.length})</h2>
        <div className="mt-3 space-y-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Няма чакащи.</p>}
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
                <Button size="sm" disabled={busyId === r.id} onClick={() => void decide(r.id, true)}>
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
        <h2 className="text-lg font-semibold">Одобрени ({approved.length})</h2>
        <div className="mt-3 space-y-2">
          {approved.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <p className="text-sm">
                {r.email ?? r.id}
                {r.is_admin && <span className="ml-2 text-xs text-primary">админ</span>}
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === r.id}
                onClick={() => void decide(r.id, false)}
              >
                Отнеми достъпа
              </Button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
