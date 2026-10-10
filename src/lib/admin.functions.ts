import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminProfile = {
  id: string;
  email: string | null;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
  /** Оставащи кредити за нови доклади (само за админ в списъка). */
  credits: number;
  /** Чакаща заявка за още доклади (само за админ в списъка). */
  pendingRequest: { id: string; amount: number; note: string | null; created_at: string } | null;
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
    const profiles = (data ?? []) as Omit<AdminProfile, "credits" | "pendingRequest">[];
    const isAdmin = profiles.some((p) => p.id === context.userId && p.is_admin);
    const { getAllCredits, listPendingRequests } = await import("@/lib/credits.server");
    const credits = isAdmin ? await getAllCredits() : new Map<string, number>();
    // Таблицата `credit_requests` може още да не е създадена (миграцията се пуска ръчно) —
    // списъкът с потребители не бива да зависи от нея.
    const requests = isAdmin
      ? await listPendingRequests().catch(() => new Map<string, never>())
      : new Map<string, never>();
    return profiles.map((p) => {
      const r = requests.get(p.id);
      return {
        ...p,
        credits: credits.get(p.id) ?? 0,
        pendingRequest: r
          ? { id: r.id, amount: r.amount, note: r.note, created_at: r.created_at }
          : null,
      };
    });
  });

/** Добавя (положително) или маха (отрицателно) кредити, или задава точна стойност. Само админ. */
export const setReportCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .union([
        z.object({ id: z.string().uuid(), add: z.number().int().min(-100).max(100) }),
        z.object({ id: z.string().uuid(), set: z.number().int().min(0).max(1000) }),
      ])
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.is_admin) throw new Error("Нямате права за тази операция.");

    const { adjustCredits, getCredits } = await import("@/lib/credits.server");
    const delta = "add" in data ? data.add : data.set - (await getCredits(data.id));
    const balance = await adjustCredits(data.id, delta);
    return { credits: balance ?? 0 };
  });

/** Одобрява (зарежда исканите доклади) или отказва заявка на потребител за още доклади. */
export const resolveCreditRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.is_admin) throw new Error("Нямате права за тази операция.");

    const { resolveRequest } = await import("@/lib/credits.server");
    const res = await resolveRequest(data.id, data.approve);
    return { amount: res.amount, balance: res.balance };
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

export type AdminReportRow = {
  id: string;
  user_id: string;
  email: string | null;
  ekatte: number | null;
  place_name: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
};

export type AdminUserStats = {
  user_id: string;
  email: string | null;
  count: number;
  last_at: string;
};

export type AdminReportsResult = {
  total: number;
  users: AdminUserStats[];
  reports: AdminReportRow[];
};

/**
 * Статистика за генерираните доклади: по потребител и последните доклади (за всички или за един потребител).
 * Личните данни (настояща локация, цел) не се четат — те са в `report_personal`.
 * `reports` има един ред на потребител и място, който се обновява при повторно генериране.
 */
export const listReportsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminReportsResult> => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.is_admin) throw new Error("Нямате права за тази операция.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: all, error: allError } = await supabaseAdmin
      .from("reports")
      .select("user_id, created_at, updated_at")
      .limit(10000);
    if (allError) throw new Error(allError.message);

    const stats = new Map<string, { count: number; last_at: string }>();
    for (const r of all ?? []) {
      const last = r.updated_at > r.created_at ? r.updated_at : r.created_at;
      const prev = stats.get(r.user_id);
      stats.set(r.user_id, {
        count: (prev?.count ?? 0) + 1,
        last_at: prev && prev.last_at > last ? prev.last_at : last,
      });
    }

    let query = supabaseAdmin
      .from("reports")
      .select("id, user_id, ekatte, place_name, created_at, updated_at, is_public")
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.userId) query = query.eq("user_id", data.userId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = [...new Set([...stats.keys(), ...(rows ?? []).map((r) => r.user_id)])];
    const emails = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", ids);
      for (const p of profiles ?? []) emails.set(p.id, p.email);
    }

    return {
      total: all?.length ?? 0,
      users: [...stats.entries()]
        .map(([user_id, s]) => ({ user_id, email: emails.get(user_id) ?? null, ...s }))
        .sort((a, b) => b.count - a.count),
      reports: (rows ?? []).map((r) => ({ ...r, email: emails.get(r.user_id) ?? null })),
    };
  });

/** Пълното съдържание на запазен доклад (без личните данни) — за проверка от администратора. */
export const getReportAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ content: string; updated_at: string }> => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.is_admin) throw new Error("Нямате права за тази операция.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("reports")
      .select("report_content, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Докладът не е намерен.");
    return { content: row.report_content, updated_at: row.updated_at };
  });
