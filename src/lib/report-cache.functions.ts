import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { expiresAtFor, isFresh, type CachedCategory } from "@/lib/report-cache";

/**
 * Връща категория от кеша, ако е валидна; иначе я генерира наново и я кешира.
 * Частите, зависещи от „Настояща локация“, се смятат отделно в клиента.
 */
export const getCategory = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ ekatte: z.number().int(), categoryId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }): Promise<CachedCategory & { fromCache: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateCategory } = await import("@/lib/report-generator.server");

    const { data: row } = await supabaseAdmin
      .from("report_cache")
      .select("*")
      .eq("ekatte", data.ekatte)
      .eq("category_id", data.categoryId)
      .maybeSingle();

    if (row && isFresh(row.expires_at)) {
      return {
        ekatte: row.ekatte,
        categoryId: row.category_id,
        data: row.data,
        sourceLinks: (row.source_links as CachedCategory["sourceLinks"]) ?? null,
        incidentCount: row.incident_count,
        cachedAt: row.cached_at,
        expiresAt: row.expires_at,
        fromCache: true,
      };
    }

    const generated = await generateCategory(data.ekatte, data.categoryId);
    const expiresAt = expiresAtFor(data.categoryId);
    const cachedAt = new Date().toISOString();

    if (expiresAt !== undefined) {
      await supabaseAdmin.from("report_cache").upsert(
        {
          ekatte: data.ekatte,
          category_id: data.categoryId,
          data: generated.data as never,
          source_links: generated.sourceLinks as never,
          incident_count: generated.incidentCount,
          cached_at: cachedAt,
          expires_at: expiresAt,
        },
        { onConflict: "ekatte,category_id" },
      );
    }

    return {
      ekatte: data.ekatte,
      categoryId: data.categoryId,
      data: generated.data,
      sourceLinks: generated.sourceLinks,
      incidentCount: generated.incidentCount,
      cachedAt,
      expiresAt: expiresAt ?? null,
      fromCache: false,
    };
  });
