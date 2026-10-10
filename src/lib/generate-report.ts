import { toast } from "sonner";

import { CATEGORY_IDS, categoryLabel } from "@/lib/categories";
import type { PurposeId } from "@/lib/purposes";
import { REPORT_DATA_SOURCE } from "@/lib/report-mode";
import { generateMockCategory, generateMockPerspectiveSummary } from "@/lib/mock-report-generator";
import { getCategory } from "@/lib/report-cache.functions";
import { ONSITE_CHECKLIST_SECTION } from "@/data/onsite-checklist";
import { formatSettlement, type Settlement } from "@/lib/settlements";
import type { ReportSection } from "@/data/mock-report";

export const IS_MOCK = REPORT_DATA_SOURCE === "mock";

export type ReportPayload = {
  place: Settlement;
  current: Settlement | null;
  purpose: PurposeId | null;
  sections: ReportSection[];
  /** Кога е генериран докладът (ISO). Липсва в доклади, запазени преди добавянето на полето. */
  generatedAt?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function totalSteps(purpose: PurposeId | null): number {
  return CATEGORY_IDS.length + (purpose ? 1 : 0) + 1;
}

type Options = {
  place: Settlement;
  current: Settlement | null;
  purpose: PurposeId | null;
  onSections?: (sections: ReportSection[]) => void;
  onStep?: () => void;
};

/** Генерира пълен доклад (реален или примерен) за дадено населено място. */
export async function generateReportSections({
  place,
  current,
  purpose,
  onSections,
  onStep,
}: Options): Promise<{ sections: ReportSection[]; failed: number }> {
  const collected: ReportSection[] = [];
  let failed = 0;

  if (IS_MOCK) {
    for (const categoryId of CATEGORY_IDS) {
      await sleep(150);
      collected.push(generateMockCategory(categoryId));
      onSections?.([...collected]);
      onStep?.();
    }
  } else {
    // Всички категории тръгват едновременно, но броячът и докладът се обновяват още щом
    // приключи всяка една — така потребителят вижда поетапно как се попълва.
    const done = new Map<string, ReportSection>();
    const inOrder = () =>
      CATEGORY_IDS.flatMap((id) => {
        const section = done.get(id);
        return section ? [section] : [];
      });

    await Promise.all(
      CATEGORY_IDS.map(async (categoryId) => {
        try {
          const result = await getCategory({
            data: {
              ekatte: place.ekatte,
              categoryId,
              ...(current ? { currentEkatte: current.ekatte } : {}),
            },
          });
          const section = result.data as unknown as ReportSection | null;
          if (section && Array.isArray(section.blocks)) {
            done.set(categoryId, {
              ...section,
              id: categoryId,
              ...(result.sourceLinks && result.sourceLinks.length > 0
                ? { sources: result.sourceLinks }
                : {}),
              cachedAt: result.cachedAt,
            });
          } else {
            failed += 1;
          }
        } catch (err) {
          failed += 1;
          toast.error(
            `Грешка при „${categoryLabel(categoryId)}“: ${
              err instanceof Error ? err.message : "неизвестна грешка"
            }`,
          );
        }
        onSections?.(inOrder());
        onStep?.();
      }),
    );
    collected.push(...inOrder());
  }

  if (purpose) {
    if (IS_MOCK) {
      await sleep(150);
      collected.push(generateMockPerspectiveSummary(purpose));
      onSections?.([...collected]);
    }
    onStep?.();
  }

  collected.push(ONSITE_CHECKLIST_SECTION);
  onSections?.([...collected]);
  onStep?.();

  return { sections: collected, failed };
}

export function serializeReport(payload: ReportPayload): string {
  return JSON.stringify(payload);
}

export function parseReport(content: string): ReportPayload | null {
  try {
    const parsed = JSON.parse(content) as ReportPayload;
    if (!parsed || !Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch {
    return null;
  }
}
