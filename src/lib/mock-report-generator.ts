import { MOCK_REPORT, type ReportSection } from "@/data/mock-report";
import { ONSITE_CHECKLIST_SECTION } from "@/data/onsite-checklist";
import { PROMPT_MODULES } from "@/lib/prompt-modules";
import { ADDON_MODULES } from "@/lib/addon-modules";

const LOREM_LINES = [
  "Lorem ipsum dolor sit amet",
  "Consectetur adipiscing elit",
  "Sed do eiusmod tempor",
  "Incididunt ut labore et dolore",
];

const LOREM_PARAGRAPH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

function labelFor(categoryId: string): string {
  return (
    PROMPT_MODULES.find((m) => m.id === categoryId)?.label ??
    ADDON_MODULES.find((m) => m.id === categoryId)?.label ??
    categoryId
  );
}

/** Връща примерна секция за дадена категория — без никакви API извиквания. */
export function generateMockCategory(categoryId: string): ReportSection {
  if (categoryId === "onsite-checklist") return ONSITE_CHECKLIST_SECTION;

  const existing = MOCK_REPORT.find((s) => s.id === categoryId);
  if (existing) return existing;

  return {
    id: categoryId,
    title: labelFor(categoryId),
    subtitle: "Примерни данни (placeholder)",
    theme: "slate",
    blocks: [
      {
        kind: "facts",
        items: LOREM_LINES.map((line, i) => ({
          label: line,
          value: `Lorem ipsum ${i + 1}`,
        })),
      },
      {
        kind: "gauge",
        title: "Примерен тренд",
        value: 42,
        direction: "neutral",
        periodLabel: "примерен период",
        note: "Демонстрационен индикатор за визуална проверка на блока.",
      },
      { kind: "text", body: LOREM_PARAGRAPH },
    ],
  };
}

/** Placeholder за бъдещата AI-генерирана обобщена оценка спрямо избраната цел. */
export function generateMockPerspectiveSummary(purposeId: string): ReportSection {
  return {
    id: "perspective-summary",
    title: "Обобщена оценка",
    subtitle: `Спрямо избраната цел: ${purposeId}`,
    theme: "violet",
    blocks: [{ kind: "text", body: LOREM_PARAGRAPH }],
  };
}
