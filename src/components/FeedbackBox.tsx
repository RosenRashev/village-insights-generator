import { useEffect, useRef, useState } from "react";
import { Bug, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const MAX = 300;

/**
 * Обратна връзка: малка иконка „bug“, залепена за десния край на екрана. При посочване се
 * разпъва до „Коментар или препоръка“, а при натискане отваря формата.
 */
export function FeedbackBox() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector("textarea")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit() {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("feedback").insert({ message: text });
    setSending(false);
    if (error) {
      toast.error("Съобщението не беше изпратено. Опитайте отново.");
      return;
    }
    toast.success("Благодарим за обратната връзка!");
    setMessage("");
    setOpen(false);
  }

  return (
    <div className="print:hidden">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Коментар или препоръка"
          className="fixed bottom-36 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Коментар или препоръка</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Затвори"
              className="rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            rows={5}
            maxLength={MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Опишете проблем или предложение за нова функция..."
            className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground">
            {message.length}/{MAX}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!message.trim() || sending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Изпрати
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setOpen(false);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              Отказ
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Коментар или препоръка"
        aria-expanded={open}
        className="group fixed bottom-24 right-0 z-40 flex h-11 items-center gap-2 overflow-hidden rounded-l-full border border-r-0 border-border bg-card px-3 text-muted-foreground shadow-md transition-all hover:text-foreground focus-visible:text-foreground"
      >
        <Bug className="h-5 w-5 shrink-0" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 group-hover:max-w-[12rem] group-hover:opacity-100 group-focus-visible:max-w-[12rem] group-focus-visible:opacity-100">
          Коментар или препоръка
        </span>
      </button>
    </div>
  );
}
