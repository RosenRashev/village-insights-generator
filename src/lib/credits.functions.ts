import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyCreditRequest = {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export const REQUEST_AMOUNTS = [1, 2, 5, 10] as const;

/** Чакащата заявка на потребителя за още доклади (или `null`). */
export const getMyCreditRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyCreditRequest | null> => {
    const { getPendingRequest } = await import("@/lib/credits.server");
    const req = await getPendingRequest(context.userId).catch(() => null);
    return req
      ? { id: req.id, amount: req.amount, note: req.note, created_at: req.created_at }
      : null;
  });

/** Заявка към администратора за още доклади. Една чакаща заявка на потребител. */
export const requestCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        amount: z
          .number()
          .int()
          .refine((n) => (REQUEST_AMOUNTS as readonly number[]).includes(n)),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<MyCreditRequest> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.is_approved) throw new Error("Профилът ви още не е одобрен.");
    const { createRequest } = await import("@/lib/credits.server");
    const req = await createRequest(context.userId, data.amount, data.note ? data.note : null);
    const { adminIds, emailOf, notify } = await import("@/lib/notifications.server");
    const who = (await emailOf(context.userId)) ?? "Потребител";
    await notify(await adminIds(), {
      kind: "credits_request",
      title: `${who} иска ${data.amount === 1 ? "1 доклад" : `${data.amount} доклада`}`,
      body: req.note,
      link: `/admin/users/${context.userId}`,
    });
    return { id: req.id, amount: req.amount, note: req.note, created_at: req.created_at };
  });

export type MyCreditTransaction = {
  id: string;
  delta: number;
  balance_after: number | null;
  reason: "admin" | "request" | "report" | "refund" | "welcome";
  note: string | null;
  place: string | null;
  created_at: string;
};

/** История на докладите на потребителя (последните промени на баланса). */
export const getMyCreditHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyCreditTransaction[]> => {
    const { getHistory } = await import("@/lib/credits.server");
    return getHistory(context.userId, 20).catch(() => []);
  });
