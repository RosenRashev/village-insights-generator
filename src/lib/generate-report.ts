import { toast } from "sonner";

import { PROMPT_MODULES, type PlaceType, type PurposeId } from "@/lib/prompt-modules";
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
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CATEGORY_IDS = PROMPT_MODULES.map((m) => m.id);

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
  const placeType: PlaceType = place.isVillage ? "village" : "town";
  const collected: ReportSection[] = [];
  let failed = 0;

  for (const categoryId of CATEGORY_IDS) {
    if (IS_MOCK) {
      await sleep(150);
      collected.push(generateMockCategory(categoryId));
      onSections?.([...collected]);
    } else {
      try {
        const res = await getCategory({
          data: {
            ekatte: place.ekatte,
            categoryId,
            placeName: formatSettlement(place),
            placeType,
            ...(current ? { currentLocationName: formatSettlement(current) } : {}),
          },
        });
        const section = res.data as unknown as ReportSection | null;
        if (section && Array.isArray(section.blocks)) {
          collected.push({ ...section, id: categoryId });
          onSections?.([...collected]);
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        toast.error(
          `Грешка при „${PROMPT_MODULES.find((m) => m.id === categoryId)?.label ?? categoryId}“: ${
            err instanceof Error ? err.message : "неизвестна грешка"
          }`,
        );
      }
    }
    onStep?.();
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
