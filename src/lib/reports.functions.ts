import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** Създава нов запис за доклад към текущия (одобрен) потребител. */
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
    const { data: row, error } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        location_query: data.locationQuery,
        ekatte: data.ekatte ?? null,
        place_name: data.placeName ?? null,
        selected_topics: data.selectedTopics,
        report_content: data.reportContent,
        is_public: data.isPublic,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id as string };
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
    const { error } = await context.supabase
      .from("reports")
      .update({ is_public: data.isPublic })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Обновява съдържанието на съществуващ доклад (регенериране). */
export const updateReportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), reportContent: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reports")
      .update({ report_content: data.reportContent })
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
