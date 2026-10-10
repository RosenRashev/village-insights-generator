import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { needsFollowUp, splitChecks, withChecks } from "@/lib/fact-checks";
import {
  expiresAtFor,
  isCacheVersionValid,
  isFresh,
  type CachedCategory,
} from "@/lib/report-cache";

/**
 * Връща категория от кеша, ако е валидна; иначе я генерира наново през Gemini
 * (Google Search grounding) и я кешира според TTL правилата.
 * Достъпна само за одобрени потребители.
 * Частите, зависещи от „Настояща локация“, се смятат отделно и НЕ се кешират —
 * настоящата локация никога не влиза в промптовете за кешируемите категории,
 * защото кешът е споделен между всички потребители.
 */
export const getCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        ekatte: z.number().int().min(1).max(99999),
        categoryId: z.string().min(1).max(40),
        // Настоящата локация се подава като ЕКАТТЕ — името се взима от официалния списък на
        // сървъра (свободен текст от браузъра не влиза в промптовете).
        currentEkatte: z.number().int().min(1).max(99999).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<CachedCategory & { fromCache: boolean }> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.is_approved) {
      throw new Error("Профилът ви още не е одобрен за генериране на доклади.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { followUpCategory, generateCategory, generateDistanceToCurrent, promptVersionFor } =
      await import("@/lib/report-generator.server");

    // Мястото и типът му се определят от сървъра по ЕКАТТЕ, а не от браузъра: иначе някой може
    // да вмъкне свой текст в промпта или да обезсили споделения кеш с грешен тип.
    const { loadSettlements, formatSettlement, isLargeCity } = await import("@/lib/settlements");
    const all = await loadSettlements();
    const settlement = all.find((s) => s.ekatte === data.ekatte);
    if (!settlement) throw new Error("Непознато населено място.");
    const placeName = formatSettlement(settlement);
    const placeType = settlement.isVillage ? ("village" as const) : ("town" as const);
    const promptVersion = promptVersionFor(data.categoryId, placeType);

    const { data: row } = await supabaseAdmin
      .from("report_cache")
      .select("*")
      .eq("ekatte", data.ekatte)
      .eq("category_id", data.categoryId)
      .maybeSingle();

    let result: Omit<CachedCategory, "ekatte" | "categoryId"> & { fromCache: boolean };

    // Кешът важи само ако е генериран със същата версия на промпта (иначе се генерира наново).
    if (row && isFresh(row.expires_at) && isCacheVersionValid(row.prompt_version, promptVersion)) {
      let cached = {
        data: row.data as CachedCategory["data"],
        sourceLinks: (row.source_links as CachedCategory["sourceLinks"]) ?? null,
        incidentCount: row.incident_count,
        cachedAt: row.cached_at,
      };

      // Второ генериране на малко място: допроверяваме обектите, пропуснати при първото
      // (най-много веднъж). Ръчно импортираните и големите градове не минават оттук.
      const stored = splitChecks(cached.data).checks;
      if (stored && !row.prompt_version?.startsWith("manual-")) {
        if (needsFollowUp(stored, isLargeCity(settlement))) {
          try {
            const next = await followUpCategory(
              {
                ekatte: data.ekatte,
                categoryId: data.categoryId,
                placeName,
                placeType,
              },
              stored,
              cached.sourceLinks,
            );
            const followedAt = new Date().toISOString();
            await supabaseAdmin
              .from("report_cache")
              .update({
                data: next.data as never,
                source_links: next.sourceLinks as never,
                incident_count: next.incidentCount,
                cached_at: followedAt,
              })
              .eq("ekatte", data.ekatte)
              .eq("category_id", data.categoryId);
            cached = {
              data: next.data,
              sourceLinks: next.sourceLinks,
              incidentCount: next.incidentCount,
              cachedAt: followedAt,
            };
          } catch (err) {
            // Допроверката е бонус — при грешка връщаме кешираното. Отбелязваме я като направена,
            // за да не вика Gemini (с търсене) при всяко следващо отваряне.
            console.warn("[report] допроверката се провали:", err);
            const base = splitChecks(cached.data).data;
            await supabaseAdmin
              .from("report_cache")
              .update({ data: withChecks(base, { ...stored, followUpDone: true }) as never })
              .eq("ekatte", data.ekatte)
              .eq("category_id", data.categoryId)
              .then(
                () => undefined,
                () => undefined,
              );
          }
        }
      }

      result = { ...cached, expiresAt: row.expires_at, fromCache: true };
    } else {
      // Нова (платена за нас) заявка към Gemini — само ако има оставащи кредити.
      const { getQuotaStatus } = await import("@/lib/quota.server");
      const quota = await getQuotaStatus(context.supabase, context.userId);
      if (!quota.allowed) {
        throw new Error("Нямате оставащи доклади. Свържете се с администратора, за да ви зареди.");
      }
      const generated = await generateCategory({
        ekatte: data.ekatte,
        categoryId: data.categoryId,
        placeName,
        placeType,
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
            prompt_version: promptVersion,
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

    // Служебните данни за допроверка никога не стигат до клиента (нито в докладите).
    result.data = splitChecks(result.data).data;

    // „Жива“ част: разстояние/време с кола до настоящата локация — винаги прясно.
    const currentPlace = data.currentEkatte
      ? all.find((s) => s.ekatte === data.currentEkatte)
      : undefined;
    if (data.categoryId === "basic" && currentPlace) {
      try {
        const live = await generateDistanceToCurrent(placeName, formatSettlement(currentPlace));
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
