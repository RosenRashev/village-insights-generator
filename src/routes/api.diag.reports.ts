import { createFileRoute } from "@tanstack/react-router";

import { checkDiagAuth, diagDeniedResponse, diagJson } from "@/lib/diag-auth";

/**
 * Диагностика (само за четене): списък с последните запазени доклади.
 * GET /api/diag/reports?limit=50&ekatte=702  с `Authorization: Bearer <DIAG_TOKEN>`.
 * Не връща имейли, лични данни или съдържание — за съдържание вж. /api/diag/report.
 */
export const Route = createFileRoute("/api/diag/reports")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = diagDeniedResponse(
          checkDiagAuth(request.headers.get("authorization"), process.env["DIAG_TOKEN"]),
        );
        if (denied) return denied;

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
        const ekatte = Number(url.searchParams.get("ekatte")) || null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let query = supabaseAdmin
          .from("reports")
          .select("id, user_id, ekatte, place_name, is_public, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (ekatte) query = query.eq("ekatte", ekatte);
        const { data, error } = await query;
        if (error) return diagJson({ error: error.message });

        return diagJson(
          (data ?? []).map((r) => ({
            id: r.id,
            user: r.user_id.slice(0, 8),
            ekatte: r.ekatte,
            place: r.place_name,
            public: r.is_public,
            created_at: r.created_at,
            updated_at: r.updated_at,
          })),
        );
      },
    },
  },
});
