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

/** Променя баланса; с `require` не позволява да падне под 0 (връща `null` при недостатъчен баланс). */
export async function adjustCredits(
  userId: string,
  delta: number,
  require = false,
): Promise<number | null> {
  const { data, error } = await (
    await admin()
  ).rpc("adjust_report_credits", {
    p_user: userId,
    p_delta: delta,
    p_require: require,
  });
  if (error) throw new Error(error.message);
  const balance = data as number;
  return balance < 0 ? null : balance;
}
