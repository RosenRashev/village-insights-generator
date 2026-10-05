import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROMPT_MODULES } from "@/lib/prompt-modules";
import { missingSectionIds, sanitizeForPublic, stampGeneratedAt } from "@/lib/report-privacy";

const REQUIRED_SECTION_IDS = PROMPT_MODULES.map((m) => m.id);

/** Колко доклада може да генерира потребителят още днес (администраторът е без ограничения). */
export const getMyQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getQuotaStatus } = await import("@/lib/quota.server");
    return getQuotaStatus(context.supabase, context.userId);
  });

export type SavedReport = {
  id: string;
  location_query: string;
  ekatte: number | null;
  place_name: string | null;
  selected_topics: string[];
  report_content: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Запазва доклад за текущия (одобрен) потребител. За всяко населено място има един доклад
 * на акаунт: ако вече има такъв, той се обновява (а не се създава втори).
 */
export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        locationQuery: z.string().min(1),
        ekatte: z.number().int().nullable().optional(),
        placeName: z.string().nullable().optional(),
        selectedTopics: z.array(z.string()),
        reportContent: z.string().min(1),
        isPublic: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const missing = missingSectionIds(data.reportContent, REQUIRED_SECTION_IDS);
    if (missing.length > 0) {
      throw new Error("Докладът е непълен и не може да бъде запазен.");
    }

    let existingId: string | null = null;
    if (data.ekatte != null) {
      const { data: existing, error: findError } = await context.supabase
        .from("reports")
        .select("id")
        .eq("user_id", context.userId)
        .eq("ekatte", data.ekatte)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      existingId = existing?.id ?? null;
    }

    // Лимитът важи за нови доклади; актуализацията на съществуващ не е нов доклад.
    if (!existingId) {
      const { getQuotaStatus } = await import("@/lib/quota.server");
      const quota = await getQuotaStatus(context.supabase, context.userId);
      if (!quota.allowed) {
        throw new Error("Достигнахте дневния лимит от доклади. Опитайте отново утре.");
      }
    }

    const stamped = stampGeneratedAt(data.reportContent, new Date().toISOString());
    // Публичните доклади никога не съдържат личната локация и целта на автора им.
    const content = data.isPublic ? sanitizeForPublic(stamped) : stamped;

    const fields = {
      location_query: data.locationQuery,
      ekatte: data.ekatte ?? null,
      place_name: data.placeName ?? null,
      selected_topics: data.selectedTopics,
      report_content: content,
      is_public: data.isPublic,
    };

    if (existingId) {
      const { error } = await context.supabase
        .from("reports")
        .update(fields)
        .eq("id", existingId)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: existingId, updated: true };
    }

    const { data: row, error } = await context.supabase
      .from("reports")
      .insert({ user_id: context.userId, ...fields })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id as string, updated: false };
  });

export type MyReportSummary = { id: string; is_public: boolean; updated_at: string };

/** Има ли потребителят вече доклад за това населено място (за бутона „Актуализирай“). */
export const findMyReportByEkatte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ekatte: z.number().int().positive() }).parse(data))
  .handler(async ({ data, context }): Promise<MyReportSummary | null> => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select("id, is_public, updated_at")
      .eq("user_id", context.userId)
      .eq("ekatte", data.ekatte)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row ? (row as MyReportSummary) : null;
  });

/** Собственият доклад за населено място — за страницата /report/<ЕКАТТЕ>. */
export const getMyReportByEkatte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ekatte: z.number().int().positive() }).parse(data))
  .handler(async ({ data, context }): Promise<SavedReport | null> => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select(
        "id, location_query, ekatte, place_name, selected_topics, report_content, is_public, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .eq("ekatte", data.ekatte)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row ? (row as SavedReport) : null;
  });

/** Всички доклади на текущия потребител (публични и лични). */
export const listMyReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reports")
      .select(
        "id, location_query, ekatte, place_name, selected_topics, report_content, is_public, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SavedReport[];
  });

/** Превключва публичен/личен статус на собствен доклад. */
export const setReportVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), isPublic: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const update: { is_public: boolean; report_content?: string } = { is_public: data.isPublic };

    if (data.isPublic) {
      // При публикуване личната информация се изчиства от доклада завинаги.
      const { data: row, error: readError } = await context.supabase
        .from("reports")
        .select("report_content")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!row) throw new Error("Докладът не е намерен.");
      if (missingSectionIds(row.report_content, REQUIRED_SECTION_IDS).length > 0) {
        throw new Error("Непълен доклад не може да бъде публикуван.");
      }
      update.report_content = sanitizeForPublic(row.report_content);
    }

    const { error } = await context.supabase
      .from("reports")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Изтрива собствен доклад. */
export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reports")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
