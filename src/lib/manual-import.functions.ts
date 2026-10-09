import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImportedCategory = {
  categoryId: string;
  expiresAt: string | null;
};

/**
 * Само за администратор: структурира ЕДНА категория от ръчно проучване (без Google Search)
 * и я записва в споделения кеш със същата версия на промпта като обикновената генерация.
 * Вика се по веднъж на категория от страницата /admin/import, за да не се удря лимитът на функцията.
 */
export const importManualCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        ekatte: z.number().int().min(1).max(99999),
        categoryId: z.string().min(1).max(40),
        text: z.string().min(40).max(60_000),
        sources: z
          .array(z.object({ label: z.string().max(200), url: z.string().url().max(2000) }))
          .max(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ImportedCategory> => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.is_admin) throw new Error("Нямате права за тази операция.");

    const { loadSettlements } = await import("@/lib/settlements");
    const place = (await loadSettlements()).find((s) => s.ekatte === data.ekatte);
    if (!place) throw new Error(`Няма населено място с ЕКАТТЕ ${data.ekatte}.`);

    const { expiresAtFor } = await import("@/lib/report-cache");
    const expiresAt = expiresAtFor(data.categoryId);
    if (expiresAt === undefined) throw new Error("Тази категория не се кешира.");

    const { structureManualCategory, promptVersionFor } =
      await import("@/lib/report-generator.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const input = {
      ekatte: data.ekatte,
      categoryId: data.categoryId,
      placeName: place.name,
      placeType: place.isVillage ? ("village" as const) : ("town" as const),
    };
    const generated = await structureManualCategory(input, data.text, data.sources);

    const { error } = await supabaseAdmin.from("report_cache").upsert(
      {
        ekatte: data.ekatte,
        category_id: data.categoryId,
        data: generated.data as never,
        source_links: generated.sourceLinks as never,
        incident_count: generated.incidentCount,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt,
        prompt_version: promptVersionFor(data.categoryId, input.placeType),
      },
      { onConflict: "ekatte,category_id" },
    );
    if (error) throw new Error(error.message);

    return { categoryId: data.categoryId, expiresAt };
  });
