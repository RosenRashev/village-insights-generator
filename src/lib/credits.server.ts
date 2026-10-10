import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Кредити за доклади. Таблицата `report_credits` и функцията `adjust_report_credits` се
 * пишат само със service role; затова клиентът е без генерирани типове (като `report_personal`).
 */

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function getCredits(userId: string): Promise<number> {
  const { data, error } = await (
    await admin()
  )
    .from("report_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.balance as number | undefined) ?? 0;
}

export async function getAllCredits(): Promise<Map<string, number>> {
  const { data, error } = await (await admin()).from("report_credits").select("user_id, balance");
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.user_id as string, r.balance as number]));
}

export type CreditReason = "admin" | "request" | "report" | "refund" | "welcome";

export type CreditMeta = {
  reason: CreditReason;
  note?: string | null;
  place?: string | null;
  actorId?: string | null;
};

/**
 * Променя баланса; с `require` не позволява да падне под 0 (връща `null` при недостатъчен баланс).
 * С `meta` записва ред в историята (`credit_transactions`). Записът в историята е „бонус“ —
 * ако таблицата липсва или записът се провали, балансът пак е променен.
 */
export async function adjustCredits(
  userId: string,
  delta: number,
  require = false,
  meta?: CreditMeta,
): Promise<number | null> {
  const db = await admin();
  const { data, error } = await db.rpc("adjust_report_credits", {
    p_user: userId,
    p_delta: delta,
    p_require: require,
  });
  if (error) throw new Error(error.message);
  const balance = data as number;
  if (balance < 0) return null;

  if (meta && delta !== 0) {
    const { error: logError } = await db.from("credit_transactions").insert({
      user_id: userId,
      delta,
      balance_after: balance,
      reason: meta.reason,
      note: meta.note ?? null,
      place: meta.place ?? null,
      actor_id: meta.actorId ?? null,
    });
    if (logError) console.warn("[credits] историята не е записана:", logError.message);
  }
  return balance;
}

export type CreditTransaction = {
  id: string;
  delta: number;
  balance_after: number | null;
  reason: CreditReason;
  note: string | null;
  place: string | null;
  created_at: string;
};

export async function getHistory(userId: string, limit = 20): Promise<CreditTransaction[]> {
  const { data, error } = await (
    await admin()
  )
    .from("credit_transactions")
    .select("id, delta, balance_after, reason, note, place, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CreditTransaction[];
}

/** Получавал ли е потребителят вече безплатния доклад при одобрение (за да не се дава повторно). */
export async function hasWelcomeCredit(userId: string): Promise<boolean> {
  const { data, error } = await (
    await admin()
  )
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "welcome")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Заявка на потребител за още доклади (таблица `credit_requests`, пише се само от сървъра). */
export type CreditRequest = {
  id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_at: string;
};

const REQUEST_COLUMNS = "id, user_id, amount, note, created_at";

export async function getPendingRequest(userId: string): Promise<CreditRequest | null> {
  const { data, error } = await (
    await admin()
  )
    .from("credit_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CreditRequest | null) ?? null;
}

export async function listPendingRequests(): Promise<Map<string, CreditRequest>> {
  const { data, error } = await (
    await admin()
  )
    .from("credit_requests")
    .select(REQUEST_COLUMNS)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as CreditRequest[]).map((r) => [r.user_id, r]));
}

export async function createRequest(
  userId: string,
  amount: number,
  note: string | null,
): Promise<CreditRequest> {
  const { data, error } = await (
    await admin()
  )
    .from("credit_requests")
    .insert({ user_id: userId, amount, note })
    .select(REQUEST_COLUMNS)
    .single();
  if (error) {
    // 23505 = нарушен уникален индекс „една чакаща заявка на потребител“.
    if (error.code === "23505") throw new Error("Вече имате чакаща заявка за доклади.");
    throw new Error(error.message);
  }
  return data as CreditRequest;
}

/**
 * Одобрява или отказва чакаща заявка. Заявката първо се „заема“ (pending → решение), за да не
 * се зареди два пъти при двойно кликване; при грешка при зареждането се връща към pending.
 */
export async function resolveRequest(
  requestId: string,
  approve: boolean,
  actorId: string | null = null,
): Promise<{ userId: string; amount: number; balance: number | null }> {
  const db = await admin();
  const { data, error } = await db
    .from("credit_requests")
    .update({ status: approve ? "approved" : "rejected", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Заявката вече е обработена.");
  const req = data as CreditRequest;

  if (!approve) return { userId: req.user_id, amount: req.amount, balance: null };
  try {
    const balance = await adjustCredits(req.user_id, req.amount, false, {
      reason: "request",
      note: req.note,
      actorId,
    });
    return { userId: req.user_id, amount: req.amount, balance };
  } catch (err) {
    await db
      .from("credit_requests")
      .update({ status: "pending", resolved_at: null })
      .eq("id", requestId);
    throw err;
  }
}

/** Всички заявки на потребител (последните), за профила му в админ панела. */
export async function listRequestsFor(
  userId: string,
  limit = 10,
): Promise<(CreditRequest & { status: string; resolved_at: string | null })[]> {
  const { data, error } = await (
    await admin()
  )
    .from("credit_requests")
    .select(`${REQUEST_COLUMNS}, status, resolved_at`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as (CreditRequest & { status: string; resolved_at: string | null })[];
}
