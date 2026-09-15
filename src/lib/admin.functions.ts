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
