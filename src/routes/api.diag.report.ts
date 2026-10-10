import { createFileRoute } from "@tanstack/react-router";

import { checkDiagAuth, diagDeniedResponse, diagJson } from "@/lib/diag-auth";

/**
 * Диагностика (само за четене): съдържанието на доклад и редовете от кеша за мястото.
 * GET /api/diag/report?id=<uuid>             — запазен доклад по ID
 * GET /api/diag/report?ekatte=702            — най-новият запазен доклад + кешът по категории
 * Допълнителни: &category=transport (само тази категория от кеша), &include=cache|report
 * Кешът включва `data._checks` (кои проверки са потвърдени/непроверени) и `prompt_version`.
 * Лични данни (настояща локация, цел) не се четат; потребителят е само кратък идентификатор.
 */
export const Route = createFileRoute("/api/diag/report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = diagDeniedResponse(
          checkDiagAuth(request.headers.get("authorization"), process.env["DIAG_TOKEN"]),
        );
        if (denied) return denied;

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const ekatte = Number(url.searchParams.get("ekatte")) || null;
        const category = url.searchParams.get("category");
        const include = url.searchParams.get("include");
        if (!id && !ekatte) return diagJson({ error: "Подай ?id=<uuid> или ?ekatte=<код>." });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const wantReport = include !== "cache";
        const wantCache = include !== "report";
        const out: { report?: unknown; cache?: unknown } = {};
        let placeEkatte = ekatte;

        if (wantReport || id) {
          let q = supabaseAdmin
            .from("reports")
            .select(
              "id, user_id, ekatte, place_name, is_public, created_at, updated_at, report_content",
            );
          q = id
            ? q.eq("id", id)
            : q.eq("ekatte", ekatte!).order("updated_at", { ascending: false }).limit(1);
          const { data, error } = await q;
          if (error) return diagJson({ error: error.message });
          const row = data?.[0];
          if (row) {
            placeEkatte = row.ekatte ?? placeEkatte;
            let content: unknown = null;
            try {
              content = JSON.parse(row.report_content);
            } catch {
              content = row.report_content;
            }
            out.report = {
              id: row.id,
              user: row.user_id.slice(0, 8),
              ekatte: row.ekatte,
              place: row.place_name,
              public: row.is_public,
              created_at: row.created_at,
              updated_at: row.updated_at,
              content,
            };
          } else {
            out.report = null;
          }
        }

        if (wantCache && placeEkatte) {
          let q = supabaseAdmin
            .from("report_cache")
            .select(
              "category_id, data, source_links, incident_count, prompt_version, cached_at, expires_at",
            )
            .eq("ekatte", placeEkatte);
          if (category) q = q.eq("category_id", category);
          const { data, error } = await q;
          if (error) return diagJson({ error: error.message });
          out.cache = data ?? [];
        }

        return diagJson(out);
      },
    },
  },
});
