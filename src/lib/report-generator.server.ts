import { MOCK_REPORT } from "@/data/mock-report";
import type { SourceLink } from "@/lib/report-cache";

import type { Json } from "@/integrations/supabase/types";

export type GeneratedCategory = {
  data: Json;
  sourceLinks: SourceLink[] | null;
  incidentCount: number | null;
};

/**
 * Заглушка: тук по-късно ще се извиква Gemini.
 * Засега връща mock съдържанието за категорията, за да може flow-ът с кеша
 * да бъде тестван от край до край.
 */
export async function generateCategory(
  ekatte: number,
  categoryId: string,
): Promise<GeneratedCategory> {
  void ekatte;
  const section = MOCK_REPORT.find((s) => s.id === categoryId) ?? null;

  const incidentCount =
    categoryId === "risks"
      ? (section?.blocks.find((b) => b.kind === "risks")?.kind === "risks" ? 3 : null)
      : null;

  return {
    data: (section as unknown as Json) ?? null,
    sourceLinks: null,
    incidentCount,
  };
}
