import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicPlace = { ekatte: number; placeName: string; reportId: string; updatedAt: string };

/** Населени места, за които вече има публичен доклад (за гост-режима). */
export const listPublicPlaces = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPlace[]> => {
    const { data, error } = await publicClient()
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
  },
);

/** Съдържанието на конкретен публичен доклад. */
export const getPublicReport = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await publicClient()
      .from("reports")
      .select("id, place_name, ekatte, report_content, updated_at")
      .eq("id", data.id)
      .eq("is_public", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row ?? null;
  });
