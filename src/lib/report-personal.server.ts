import type { SupabaseClient } from "@supabase/supabase-js";

import type { Personal } from "@/lib/report-privacy";

/**
 * Лична част на доклада (локация, цел). Таблицата `report_personal` е само за автора (RLS).
 * Ако таблицата още не е създадена в базата, грешките се пренебрегват — докладът пак се
 * запазва, само без личната част.
 */

export async function savePersonal(
  supabase: SupabaseClient,
  reportId: string,
  userId: string,
  personal: Personal | null,
): Promise<void> {
  try {
    if (!personal) {
      await supabase.from("report_personal").delete().eq("report_id", reportId);
      return;
    }
    const { error } = await supabase.from("report_personal").upsert(
      {
        report_id: reportId,
        user_id: userId,
        data: personal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "report_id" },
    );
    if (error) console.warn("[report_personal] запис:", error.message);
  } catch (err) {
    console.warn("[report_personal] запис:", err);
  }
}

export async function loadPersonal(
  supabase: SupabaseClient,
  reportId: string,
): Promise<Personal | null> {
  try {
    const { data, error } = await supabase
      .from("report_personal")
      .select("data")
      .eq("report_id", reportId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { data: Personal }).data ?? null;
  } catch {
    return null;
  }
}
