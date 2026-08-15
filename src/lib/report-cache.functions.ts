import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { expiresAtFor, isFresh, type CachedCategory } from "@/lib/report-cache";

/**
 * Връща категория от кеша, ако е валидна; иначе я генерира наново през Gemini
 * (Google Search grounding) и я кешира според TTL правилата.
 * Частите, зависещи от „Настояща локация“, се смятат отделно и НЕ се кешират.
 */
export const getCategory = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        ekatte: z.number().int(),
        categoryId: z.string().min(1),
        placeName: z.string().min(1),
        placeType: z.enum(["village", "town", "district"]),
        currentLocationName: z.string().min(1).optional(),
        accessCode: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CachedCategory & { fromCache: boolean }> => {
    const expected = process.env["TESTER_ACCESS_CODE"];
    if (!expected || data.accessCode !== expected) {
      throw new Error("Приложението е в затворен тест — нужен е валиден код за достъп.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateCategory, generateDistanceToCurrent } = await import(
      "@/lib/report-generator.server"
    );

    const { data: row } = await supabaseAdmin
      .from("report_cache")
      .select("*")
      .eq("ekatte", data.ekatte)
      .eq("category_id", data.categoryId)
      .maybeSingle();

    let result: Omit<CachedCategory, "ekatte" | "categoryId"> & { fromCache: boolean };

    if (row && isFresh(row.expires_at)) {
      result = {
        data: row.data as CachedCategory["data"],
        sourceLinks: (row.source_links as CachedCategory["sourceLinks"]) ?? null,
        incidentCount: row.incident_count,
        cachedAt: row.cached_at,
        expiresAt: row.expires_at,
        fromCache: true,
      };
    } else {
      const generated = await generateCategory({
        ekatte: data.ekatte,
        categoryId: data.categoryId,
        placeName: data.placeName,
        placeType: data.placeType,
        currentLocationName: data.currentLocationName,
      });
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

      result = {
        data: generated.data,
        sourceLinks: generated.sourceLinks,
        incidentCount: generated.incidentCount,
        cachedAt,
        expiresAt: expiresAt ?? null,
        fromCache: false,
      };
    }

    // „Жива“ част: разстояние/време с кола до настоящата локация — винаги прясно.
    if (data.categoryId === "basic" && data.currentLocationName) {
      try {
        const live = await generateDistanceToCurrent(data.placeName, data.currentLocationName);
        const section = result.data as { blocks?: unknown[] } | null;
        if (section && Array.isArray(section.blocks)) {
          section.blocks = [live.block, ...section.blocks];
        }
        if (live.sources.length > 0) {
          result.sourceLinks = [...(result.sourceLinks ?? []), ...live.sources];
        }
      } catch {
        // Липсата на живата част не бива да проваля целия доклад.
      }
    }

    return { ekatte: data.ekatte, categoryId: data.categoryId, ...result };
  });
