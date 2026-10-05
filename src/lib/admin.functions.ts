import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminProfile = {
  id: string;
  email: string | null;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
};

/**
 * Всички профили — RLS пропуска чужди редове само за администратор,
 * така че неадмин получава единствено собствения си ред.
 */
export const listProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminProfile[]> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, is_approved, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminProfile[];
  });

/** Одобрява или отказва регистрация. Редът се запазва при отказ. */
export const setProfileApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), approved: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("profiles")
      .update({ is_approved: data.approved })
      .eq("id", data.id)
      .select("id");

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Нямате права за тази операция.");
    return { ok: true };
  });

export type FeedbackRow = { id: string; message: string; created_at: string };

/**
 * Обратната връзка от формата на сайта. Таблицата `feedback` няма политика за четене,
 * затова админът се проверява тук (през неговия профил), а данните се четат със сървърния ключ.
 */
export const listFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackRow[]> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.is_admin) throw new Error("Нямате права за тази операция.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("id, message, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as FeedbackRow[];
  });

/** Изтрива съобщение от обратната връзка (само админ). */
export const deleteFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.is_admin) throw new Error("Нямате права за тази операция.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
