import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { REQUEST_AMOUNTS, requestCredits } from "@/lib/credits.functions";

/** Малка форма: колко доклада иска потребителят + бележка. Заявката се одобрява от админ. */
export function RequestCreditsForm({ userId, onDone }: { userId: string; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(2);
  const [note, setNote] = useState("");

  const send = useMutation({
    mutationFn: () => requestCredits({ data: { amount, ...(note.trim() ? { note } : {}) } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-credit-request", userId] });
      toast.success("Заявката е изпратена. Ще ви заредим доклади възможно най-скоро.");
      onDone?.();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Заявката не можа да се изпрати.");
    },
  });

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground">Колко доклада искате?</legend>
        <div className="mt-1.5 flex gap-1.5">
          {REQUEST_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(n)}
              aria-pressed={amount === n}
              className={`h-8 min-w-9 rounded-md border px-2 text-sm font-medium transition-colors ${
                amount === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-primary/10"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="credit-note" className="text-xs font-medium text-muted-foreground">
          Бележка (по желание)
        </label>
        <textarea
          id="credit-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          rows={2}
          maxLength={300}
          placeholder="напр. за кои места ви трябват"
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </div>
      <Button type="submit" size="sm" className="w-full" disabled={send.isPending}>
        {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Изпрати заявка
      </Button>
    </form>
  );
}
