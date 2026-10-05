import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeForPublic } from "@/lib/report-privacy";

/**
 * Публичните доклади се виждат само от влезли потребители (с акаунт) — затова всички тези
 * функции изискват вход и четат с токена на потребителя, а не с анонимния ключ.
 */

export type PublicPlace = {
  ekatte: number;
  placeName: string;
  reportId: string;
  updatedAt: string;
};

/** Населени места, за които вече има публичен доклад. */
export const listPublicPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicPlace[]> => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, ekatte, place_name, updated_at")
      .eq("is_public", true)
      .not("ekatte", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const seen = new Set<number>();
    const out: PublicPlace[] = [];
    for (const row of data ?? []) {
      const ekatte = row.ekatte as number | null;
      if (ekatte === null || seen.has(ekatte)) continue;
      seen.add(ekatte);
      out.push({
        ekatte,
        placeName: (row.place_name as string | null) ?? "",
        reportId: row.id as string,
        updatedAt: row.updated_at as string,
      });
    }
    return out;
  });

export type PublicReport = {
  id: string;
  place_name: string | null;
  ekatte: number | null;
  report_content: string;
  updated_at: string;
};

const PUBLIC_REPORT_COLUMNS = "id, place_name, ekatte, report_content, updated_at";

/** Старите публични доклади може да съдържат лична локация — изчистваме я при всяко четене. */
function cleaned(row: PublicReport | null): PublicReport | null {
  return row ? { ...row, report_content: sanitizeForPublic(row.report_content) } : null;
}

/** Най-новият публичен доклад за населено място (за страницата /report/<ЕКАТТЕ>). */
export const getPublicReportByEkatte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ekatte: z.number().int().positive() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select(PUBLIC_REPORT_COLUMNS)
      .eq("ekatte", data.ekatte)
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return cleaned(row as PublicReport | null);
  });
