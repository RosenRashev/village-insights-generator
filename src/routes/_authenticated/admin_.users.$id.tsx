import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  getAdminUser,
  resolveCreditRequest,
  setReportCredits,
  type AdminUserDetail,
} from "@/lib/admin.functions";
import { reasonLabel, signed } from "@/lib/credit-labels";

export const Route = createFileRoute("/_authenticated/admin_/users/$id")({
  head: () => ({
    meta: [{ title: "Потребител — Къде Да" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminUserPage,
});

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABEL: Record<string, string> = {
  pending: "Чака",
  approved: "Одобрена",
  rejected: "Отказана",
};

function AdminUserPage() {
  const { id } = Route.useParams();
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) void navigate({ to: "/" });
  }, [loading, profile, navigate]);

  const load = async () => {
    try {
      setUser(await getAdminUser({ data: { id } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно зареждане.");
    }
  };

  useEffect(() => {
    if (profile?.is_admin) void load();
  }, [profile?.is_admin, id]);

  if (loading || !profile?.is_admin || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const add = async (n: number) => {
    if (!Number.isInteger(n) || n === 0) return;
    setBusy(true);
    try {
      const res = await setReportCredits({ data: { id, add: n } });
      toast.success(`Докладите са ${res.credits}.`);
      setCustom("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешна промяна.");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (requestId: string, approve: boolean) => {
    setBusy(true);
    try {
      const res = await resolveCreditRequest({ data: { id: requestId, approve } });
      toast.success(approve ? `Заредени са ${res.amount} доклада.` : "Заявката е отказана.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешна промяна.");
    } finally {
      setBusy(false);
    }
  };

  const pending = user.requests.find((r) => r.status === "pending") ?? null;
  const p = user.profile;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-primary">{p.email ?? p.id}</h1>
          <p className="text-sm text-muted-foreground">
            Регистриран на {fmt(p.created_at)}
            {p.is_admin && " · админ"}
            {!p.is_approved && " · неодобрен"}
          </p>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary">
          ← Админ
        </Link>
      </div>

      <section className="mt-8 rounded-xl border border-border p-4">
        <h2 className="text-lg font-semibold">Доклади</h2>
        {p.is_admin ? (
          <p className="mt-2 text-sm text-muted-foreground">Администраторът няма ограничение.</p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold tabular-nums">{user.credits}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[1, 2, 5, 10].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void add(n)}
                >
                  +{n}
                </Button>
              ))}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void add(Number(custom));
                }}
              >
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^\d-]/g, ""))}
                  inputMode="numeric"
                  placeholder="напр. 3"
                  aria-label="Брой доклади за добавяне (отрицателно — махане)"
                  className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={busy || !custom || custom === "-"}>
                  Добави
                </Button>
              </form>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || user.credits === 0}
                onClick={() => void add(-user.credits)}
              >
                Нулирай
              </Button>
            </div>
          </>
        )}
      </section>

      {pending && (
        <section className="mt-6 rounded-xl border border-amber-400/60 bg-amber-500/10 p-4">
          <h2 className="font-semibold">
            Чакаща заявка: {pending.amount} {pending.amount === 1 ? "доклад" : "доклада"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Изпратена на {fmt(pending.created_at)}
          </p>
          <p className="mt-3 rounded-md bg-background/70 p-3 text-sm">
            {pending.note ? (
              `„${pending.note}“`
            ) : (
              <span className="text-muted-foreground">Без бележка.</span>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void resolve(pending.id, true)}>
              Одобри +{pending.amount}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void resolve(pending.id, false)}
            >
              Откажи
            </Button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">История на докладите</h2>
        {user.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Няма записи.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border">
            {user.history.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block">{reasonLabel(t.reason)}</span>
                  {(t.place || t.note) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.place ?? `„${t.note}“`}
                    </span>
                  )}
                  <span className="block text-[11px] text-muted-foreground">
                    {fmt(t.created_at)}
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
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Заявки</h2>
        {user.requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Няма заявки.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border">
            {user.requests.map((r) => (
              <li key={r.id} className="px-3 py-2 text-sm">
                <span className="flex justify-between gap-3">
                  <span>
                    {r.amount} {r.amount === 1 ? "доклад" : "доклада"} ·{" "}
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                </span>
                {r.note && <span className="block text-xs text-muted-foreground">„{r.note}“</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Доклади на потребителя ({user.reports.length})</h2>
        {user.reports.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Още няма доклади.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border">
            {user.reports.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{r.place_name ?? r.ekatte ?? "—"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmt(r.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/admin/reports" className="mt-2 inline-block text-xs text-primary underline">
          Преглед на докладите
        </Link>
      </section>
    </main>
  );
}
