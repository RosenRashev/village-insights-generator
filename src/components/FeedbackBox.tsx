import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const MAX = 300;

export function FeedbackBox() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

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

  if (!open) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          Коментар / препоръка
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-md">
      <textarea
        rows={7}
        maxLength={MAX}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Опишете проблем или предложение за нова функция..."
        className="w-full resize-none rounded-md border border-border bg-background p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="mt-1 text-right text-[11px] text-muted-foreground">
        {message.length}/{MAX}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!message.trim() || sending}
          className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          Изпрати
        </button>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setOpen(false);
          }}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          Отказ
        </button>
      </div>
    </div>
  );
}
