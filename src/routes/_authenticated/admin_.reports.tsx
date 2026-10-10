import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ReportInfographic } from "@/components/ReportInfographic";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  getReportAdmin,
  listReportsAdmin,
  type AdminReportRow,
  type AdminReportsResult,
} from "@/lib/admin.functions";
import { parseReport } from "@/lib/generate-report";

export const Route = createFileRoute("/_authenticated/admin_/reports")({
  head: () => ({
    meta: [{ title: "Доклади — Къде Да" }, { name: "robots", content: "noindex" }],
  }),
  component: ReportsPage,
});

const dateFmt = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fmt(iso: string): string {
  return dateFmt.format(new Date(iso));
}

function ReportsPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [result, setResult] = useState<AdminReportsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ id: string; content: string; updated_at: string } | null>(
    null,
  );

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) void navigate({ to: "/" });
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile?.is_admin) return;
    let cancelled = false;
    setBusy(true);
    listReportsAdmin({ data: { ...(userId ? { userId } : {}), limit: 100 } })
      .then((r) => !cancelled && setResult(r))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Неуспешно зареждане."))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [profile?.is_admin, userId]);

  const payload = useMemo(() => (opened ? parseReport(opened.content) : null), [opened]);

  if (loading || !profile?.is_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const open = async (r: AdminReportRow) => {
    setOpenId(r.id);
    setOpened(null);
    try {
      const res = await getReportAdmin({ data: { id: r.id } });
      setOpened({ id: r.id, ...res });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно зареждане на доклада.");
      setOpenId(null);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("ID на доклада е копирано.");
    } catch {
      toast.error("Копирането не успя.");
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Доклади</h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary">
          ← Админ
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Един ред на потребител и място (повторното генериране обновява реда). Личните данни
        (настояща локация, цел) не се показват.
      </p>

      {result && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">
            По потребител ({result.users.length}) · общо {result.total} доклада
          </h2>
          <div className="mt-3 overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Потребител</th>
                  <th className="px-3 py-2">Доклади</th>
                  <th className="px-3 py-2">Последен</th>
                </tr>
              </thead>
              <tbody>
                {result.users.map((u) => (
                  <tr
                    key={u.user_id}
                    className={`cursor-pointer border-t hover:bg-muted/40 ${
                      userId === u.user_id ? "bg-primary/5" : ""
                    }`}
                    onClick={() => setUserId(userId === u.user_id ? null : u.user_id)}
                  >
                    <td className="px-3 py-2">{u.email ?? u.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 tabular-nums">{u.count}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt(u.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Клик върху потребител филтрира докладите по-долу.
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {userId ? "Доклади на избрания потребител" : "Последни доклади"}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </h2>
        <div className="mt-3 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Обновен</th>
                <th className="px-3 py-2">Потребител</th>
                <th className="px-3 py-2">Място</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(result?.reports ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmt(r.updated_at)}</td>
                  <td className="px-3 py-2">{r.email ?? r.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    {r.ekatte != null ? (
                      <Link
                        to="/report/$ekatte"
                        params={{ ekatte: String(r.ekatte) }}
                        className="text-primary underline"
                      >
                        {r.place_name ?? r.ekatte}
                      </Link>
                    ) : (
                      (r.place_name ?? "—")
                    )}
                    {!r.is_public && (
                      <span className="ml-1 text-xs text-muted-foreground">(лично)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => void open(r)}>
                      Отвори
                    </Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => void copyId(r.id)}>
                      ID
                    </Button>
                  </td>
                </tr>
              ))}
              {result && result.reports.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Няма доклади.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {openId && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Преглед на доклада</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpenId(null);
                setOpened(null);
              }}
            >
              Затвори
            </Button>
          </div>
          {!opened && <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />}
          {opened && !payload && (
            <p className="mt-4 text-sm text-destructive">Съдържанието на доклада не се чете.</p>
          )}
          {opened && payload && (
            <div className="mt-4 -mx-4">
              <ReportInfographic
                place={payload.place}
                current={null}
                sections={payload.sections}
                demo={false}
                purpose={null}
                generatedAt={payload.generatedAt ?? opened.updated_at}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
