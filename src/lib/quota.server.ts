import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getCredits } from "@/lib/credits.server";

export type QuotaStatus = {
  unlimited: boolean;
  /** Оставащи кредити (нови доклади); `null` за администратор. */
  credits: number | null;
  allowed: boolean;
};

/** Администраторът е без ограничения; останалите генерират само докато имат кредити. */
export async function getQuotaStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<QuotaStatus> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_admin) return { unlimited: true, credits: null, allowed: true };

  const credits = await getCredits(userId);
  return { unlimited: false, credits, allowed: credits > 0 };
}
