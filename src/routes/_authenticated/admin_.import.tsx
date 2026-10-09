import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { importManualCategory } from "@/lib/manual-import.functions";
import { parseManualResearch } from "@/lib/manual-research";
import { PROMPT_MODULES } from "@/lib/prompt-modules";

/** Градовете от docs/manual-research/cities.md (ЕКАТТЕ). */
const CITIES: { name: string; ekatte: number }[] = [
  { name: "Асеновград", ekatte: 702 },
  { name: "Перник", ekatte: 55871 },
  { name: "Пазарджик", ekatte: 55155 },
  { name: "Благоевград", ekatte: 4279 },
  { name: "Велико Търново", ekatte: 10447 },
  { name: "Хасково", ekatte: 77195 },
  { name: "Сливен", ekatte: 67338 },
  { name: "Добрич", ekatte: 72624 },
  { name: "Шумен", ekatte: 83510 },
  { name: "Ямбол", ekatte: 87374 },
  { name: "Враца", ekatte: 12259 },
  { name: "Габрово", ekatte: 14218 },
  { name: "Казанлък", ekatte: 35167 },
  { name: "Видин", ekatte: 10971 },
  { name: "Кърджали", ekatte: 40909 },
  { name: "Кюстендил", ekatte: 41112 },
  { name: "Монтана", ekatte: 48489 },
  { name: "Димитровград", ekatte: 21052 },
  { name: "Търговище", ekatte: 73626 },
  { name: "Ловеч", ekatte: 43952 },
  { name: "Силистра", ekatte: 66425 },
  { name: "Разград", ekatte: 61710 },
  { name: "Дупница", ekatte: 68789 },
  { name: "Горна Оряховица", ekatte: 16359 },
];

type Status = "pending" | "running" | "done" | "error";

export const Route = createFileRoute("/_authenticated/admin_/import")({
  head: () => ({
    meta: [{ title: "Импорт на проучване — Къде Да" }, { name: "robots", content: "noindex" }],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [ekatte, setEkatte] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Record<string, { state: Status; error?: string }>>({});

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) void navigate({ to: "/" });
  }, [loading, profile, navigate]);

  const parsed = useMemo(() => parseManualResearch(text), [text]);
  const ekatteNum = Number(ekatte);
  const validEkatte = Number.isInteger(ekatteNum) && ekatteNum > 0 && ekatteNum <= 99999;

  if (loading || !profile?.is_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const run = async () => {
    if (!validEkatte || parsed.categories.length === 0) return;
    setBusy(true);
    setStatus(Object.fromEntries(parsed.categories.map((c) => [c.id, { state: "pending" }])));
    let failed = 0;
    for (const c of parsed.categories) {
      setStatus((s) => ({ ...s, [c.id]: { state: "running" } }));
      try {
        await importManualCategory({
          data: { ekatte: ekatteNum, categoryId: c.id, text: c.text, sources: c.sources },
        });
        setStatus((s) => ({ ...s, [c.id]: { state: "done" } }));
      } catch (err) {
        failed += 1;
        const error = err instanceof Error ? err.message : "Неуспешен импорт.";
        setStatus((s) => ({ ...s, [c.id]: { state: "error", error } }));
      }
    }
    setBusy(false);
    if (failed === 0) toast.success("Всички категории са импортирани в кеша.");
    else toast.error(`${failed} категории не се импортираха — вж. списъка.`);
  };

  const label = (id: string) => PROMPT_MODULES.find((m) => m.id === id)?.label ?? id;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">Импорт на ръчно проучване</h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary">
          ← Админ
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Постави целия отговор от „Градски досиета“. Всяка категория минава само през стъпката за
        структуриране (без Google Search) и се записва в споделения кеш. Съществуваща категория за
        същото място се заменя.
      </p>

      <div className="mt-6 grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Град</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={CITIES.some((c) => String(c.ekatte) === ekatte) ? ekatte : ""}
              onChange={(e) => setEkatte(e.target.value)}
              disabled={busy}
            >
              <option value="">— избери —</option>
              {CITIES.map((c) => (
                <option key={c.ekatte} value={c.ekatte}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">или ЕКАТТЕ</span>
            <input
              className="h-10 w-32 rounded-md border bg-background px-3"
              inputMode="numeric"
              value={ekatte}
              onChange={(e) => setEkatte(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              placeholder="напр. 00702"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Текст от Gemini</span>
          <textarea
            className="min-h-64 rounded-md border bg-background p-3 font-mono text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            spellCheck={false}
            placeholder="## КАТЕГОРИЯ: basic …"
          />
        </label>

        {text.trim() && (
          <div className="rounded-md border p-3 text-sm">
            <p>
              Разпознати категории: <b>{parsed.categories.length}</b> от {PROMPT_MODULES.length}
            </p>
            {parsed.missingIds.length > 0 && (
              <p className="mt-1 text-amber-600">Липсват: {parsed.missingIds.join(", ")}</p>
            )}
            {parsed.unknownIds.length > 0 && (
              <p className="mt-1 text-amber-600">
                Непознати заглавия (пропускат се): {parsed.unknownIds.join(", ")}
              </p>
            )}
            {parsed.emptyIds.length > 0 && (
              <p className="mt-1 text-amber-600">Без текст: {parsed.emptyIds.join(", ")}</p>
            )}
          </div>
        )}

        <div>
          <Button
            onClick={() => void run()}
            disabled={busy || !validEkatte || parsed.categories.length === 0}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Импортирай {parsed.categories.length > 0 ? `(${parsed.categories.length})` : ""}
          </Button>
        </div>

        {Object.keys(status).length > 0 && (
          <ul className="grid gap-1 text-sm">
            {parsed.categories.map((c) => {
              const st = status[c.id];
              return (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="mt-0.5 w-4 shrink-0">
                    {st?.state === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {st?.state === "done" && <Check className="h-4 w-4 text-emerald-600" />}
                    {st?.state === "error" && <X className="h-4 w-4 text-destructive" />}
                  </span>
                  <span>
                    {label(c.id)}
                    {st?.state === "error" && (
                      <span className="block text-xs text-destructive">{st.error}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
