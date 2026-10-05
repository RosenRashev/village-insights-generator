import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { FREE_DAILY_REPORTS } from "@/lib/plans";

export type QuotaStatus = {
  unlimited: boolean;
  used: number;
  limit: number | null;
  allowed: boolean;
};

/** Колко нови доклада е запазил потребителят през последните 24 часа спрямо позволеното. */
export async function getQuotaStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<QuotaStatus> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_admin) return { unlimited: true, used: 0, limit: null, allowed: true };

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw new Error(error.message);

  const used = count ?? 0;
  return { unlimited: false, used, limit: FREE_DAILY_REPORTS, allowed: used < FREE_DAILY_REPORTS };
}
