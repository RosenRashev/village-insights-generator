import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROMPT_MODULES } from "@/lib/prompt-modules";
import {
  mergePersonal,
  missingSectionIds,
  splitPersonal,
  stampGeneratedAt,
  type Personal,
} from "@/lib/report-privacy";

const REQUIRED_SECTION_IDS = PROMPT_MODULES.map((m) => m.id);
const NO_CREDITS_MESSAGE =
  "Нямате оставащи доклади. Свържете се с администратора, за да ви зареди.";

/** Оставащите кредити за нови доклади (администраторът е без ограничения). */
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
    let charged = false;
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
        throw new Error(NO_CREDITS_MESSAGE);
      }
      // Кредитът се взема атомарно преди запис; при грешка се връща.
      if (!quota.unlimited) {
        const { adjustCredits } = await import("@/lib/credits.server");
        const balance = await adjustCredits(context.userId, -1, true, {
          reason: "report",
          place: data.placeName ?? data.locationQuery,
        });
        if (balance === null) {
          throw new Error(NO_CREDITS_MESSAGE);
        }
        charged = true;
        if (balance === 0) {
          const { notify } = await import("@/lib/notifications.server");
          await notify([context.userId], {
            kind: "credits_empty",
            title: "Използвахте последния си доклад",
            body: "Можете да заявите още от кутийката с доклади до профилната снимка.",
          });
        }
      }
    }

    const stamped = stampGeneratedAt(data.reportContent, new Date().toISOString());
    // Докладът в базата е винаги „чист“ (без настояща локация и цел) — така другите потребители
    // никога не го виждат, дори и през API. Личното се пази отделно и се връща само на автора.
    const { publicContent: content, personal } = splitPersonal(stamped);
    const { savePersonal } = await import("@/lib/report-personal.server");

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
      await savePersonal(context.supabase as never, existingId, context.userId, personal);
      return { id: existingId, updated: true };
    }

    const { data: row, error } = await context.supabase
      .from("reports")
      .insert({ user_id: context.userId, ...fields })
      .select("id")
      .single();

    if (error) {
      if (charged) {
        const { adjustCredits } = await import("@/lib/credits.server");
        await adjustCredits(context.userId, 1, false, {
          reason: "refund",
          place: data.placeName ?? data.locationQuery,
        }).catch(() => null);
      }
      throw new Error(error.message);
    }
    await savePersonal(context.supabase as never, row.id as string, context.userId, personal);
    return { id: row.id as string, updated: false };
  });

export type MyReportPlace = { ekatte: number; placeName: string; updatedAt: string };

/** Населените места, за които потребителят вече има доклад (за страницата „Сравнение“). */
export const listMyReportPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyReportPlace[]> => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("ekatte, place_name, updated_at")
      .eq("user_id", context.userId)
      .not("ekatte", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const seen = new Set<number>();
    const out: MyReportPlace[] = [];
    for (const row of data ?? []) {
      const ekatte = row.ekatte as number | null;
      if (ekatte === null || seen.has(ekatte)) continue;
      seen.add(ekatte);
      out.push({
        ekatte,
        placeName: (row.place_name as string | null) ?? "",
        updatedAt: row.updated_at as string,
      });
    }
    return out;
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
    if (!row) return null;

    // Авторът вижда доклада си заедно с личната си информация.
    const { loadPersonal } = await import("@/lib/report-personal.server");
    const personal = await loadPersonal(context.supabase as never, row.id as string);
    const report = row as SavedReport;
    return { ...report, report_content: mergePersonal(report.report_content, personal) };
  });

export type MyReportListItem = Pick<
  SavedReport,
  "id" | "location_query" | "ekatte" | "place_name" | "is_public" | "created_at" | "updated_at"
>;

/** Докладите на текущия потребител за списъка „Моите доклади“ — без самото съдържание (по-леко и бързо). */
export const listMyReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyReportListItem[]> => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, location_query, ekatte, place_name, is_public, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as MyReportListItem[];
  });

/** Превключва публичен/личен статус на собствен доклад. */
export const setReportVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), isPublic: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const update: { is_public: boolean; report_content?: string } = { is_public: data.isPublic };
    let migrated: Personal | null = null;

    if (data.isPublic) {
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
      // Докладите, записани по-рано, може още да съдържат лична информация в самия текст —
      // при публикуване тя се премества в отделната лична част (само за автора).
      const { publicContent, personal } = splitPersonal(row.report_content);
      if (personal) {
        update.report_content = publicContent;
        migrated = personal;
      }
    }

    const { error } = await context.supabase
      .from("reports")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    if (migrated) {
      const { savePersonal } = await import("@/lib/report-personal.server");
      await savePersonal(context.supabase as never, data.id, context.userId, migrated);
    }
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
