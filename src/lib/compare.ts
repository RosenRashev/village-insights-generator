import type { ReportBlock, ReportSection } from "@/data/mock-report";
import { normalize, type Settlement } from "@/lib/settlements";

/**
 * Сравнение на населени места от вече запазени доклади — само четене от данните,
 * без никакви заявки към Gemini.
 */

export type CompareLevel = "good" | "fair" | "poor";
export type CompareCell = { text: string; level?: CompareLevel };
export type CompareRow = { group: string; label: string; cells: (CompareCell | null)[] };

export type ComparePlace = {
  label: string;
  place?: Settlement | null | undefined;
  sections: ReportSection[];
};

type Entry = { group: string; label: string; cell: CompareCell };

const GROUPS = {
  basic: "Общи данни",
  ratings: "Оценки",
  facts: "Ключови показатели",
  risks: "Рискове",
  trends: "Тенденции",
} as const;

/** Кутийки (facts), които си струва да се сравняват: [шаблон на етикета, показвано име]. */
const FACT_LABELS: [RegExp, string][] = [
  [/надм\.?\s*височин|надморска/i, "Надморска височина"],
  [/асфалт/i, "Асфалтирани улици"],
  [/изходи/i, "Изходи от селото"],
  [/жп спирка|жп гара/i, "ЖП спирка в селото"],
  [/автогара/i, "Автогара"],
  [/канализац/i, "Канализация"],
  [/покритие.*водопровод|водопровод/i, "Покритие на водопровода"],
  [/оператор/i, "ВиК оператор"],
  [/дълбочина/i, "Дълбочина на подземните води"],
];

const RISK_RANK = { low: 0, medium: 1, high: 2 } as const;
const RISK_TEXT = { low: "нисък", medium: "среден", high: "висок" } as const;
const RISK_LEVEL: Record<"low" | "medium" | "high", CompareLevel> = {
  low: "good",
  medium: "fair",
  high: "poor",
};

function factsOf(block: Extract<ReportBlock, { kind: "facts" }>): Entry[] {
  const out: Entry[] = [];
  for (const item of block.items) {
    if (!item.value.trim()) continue;
    const match = FACT_LABELS.find(([re]) => re.test(item.label));
    if (match) {
      out.push({ group: GROUPS.facts, label: match[1], cell: { text: item.value } });
    } else if (/летищ/i.test(item.label)) {
      out.push({
        group: GROUPS.facts,
        label: "Най-близко летище",
        cell: { text: `${item.label.replace(/^До\s+(летище\s+)?/i, "")} — ${item.value}` },
      });
    }
  }
  return out;
}

function riskEntries(block: Extract<ReportBlock, { kind: "risks" }>): Entry[] {
  if (block.items.length === 0) return [];
  const counts = { high: 0, medium: 0, low: 0 };
  let worst = block.items[0]!;
  for (const r of block.items) {
    counts[r.level] += 1;
    if (RISK_RANK[r.level] > RISK_RANK[worst.level]) worst = r;
  }
  return [
    {
      group: GROUPS.risks,
      label: "Най-сериозен риск",
      cell: { text: `${worst.label} (${RISK_TEXT[worst.level]})`, level: RISK_LEVEL[worst.level] },
    },
    {
      group: GROUPS.risks,
      label: "Брой рискове: високи / средни / ниски",
      cell: {
        text: `${counts.high} / ${counts.medium} / ${counts.low}`,
        level: counts.high > 0 ? "poor" : counts.medium > 0 ? "fair" : "good",
      },
    },
  ];
}

function entriesFor(p: ComparePlace): Entry[] {
  const out: Entry[] = [];

  if (p.place) {
    out.push({ group: GROUPS.basic, label: "Община", cell: { text: p.place.municipality } });
    out.push({ group: GROUPS.basic, label: "Област", cell: { text: p.place.province } });
    if (typeof p.place.population === "number") {
      out.push({
        group: GROUPS.basic,
        label: "Население (НСИ)",
        cell: { text: `${p.place.population.toLocaleString("bg-BG")} души` },
      });
    }
  }

  for (const section of p.sections) {
    for (const block of section.blocks) {
      switch (block.kind) {
        case "scale":
          for (const it of block.items) {
            out.push({
              group: GROUPS.ratings,
              label: it.label,
              cell: { text: it.levelText, level: it.level },
            });
          }
          break;
        case "facts":
          out.push(...factsOf(block));
          break;
        case "risks":
          out.push(...riskEntries(block));
          break;
        case "gauge": {
          const sign = block.direction === "down" ? "−" : block.direction === "up" ? "+" : "";
          const level: CompareLevel | undefined =
            block.direction === "up" ? "good" : block.direction === "down" ? "poor" : undefined;
          out.push({
            group: GROUPS.trends,
            label: block.title,
            cell: {
              text: `${sign}${block.value}%${block.periodLabel ? ` (${block.periodLabel})` : ""}`,
              ...(level ? { level } : {}),
            },
          });
          break;
        }
        case "bars": {
          const first = block.data[0];
          const last = block.data[block.data.length - 1];
          if (first && last && first !== last) {
            out.push({
              group: GROUPS.trends,
              label: block.title,
              cell: {
                text: `${first.value} (${first.label}) → ${last.value} (${last.label})`,
                level: last.value >= first.value ? "good" : "poor",
              },
            });
          }
          break;
        }
        default:
          break;
      }
    }
  }
  return out;
}

const GROUP_ORDER: string[] = Object.values(GROUPS);

/** Подрежда данните на няколко места в общи редове; ред без данни за нито едно място се пропуска. */
export function buildComparison(places: ComparePlace[]): CompareRow[] {
  const perPlace = places.map((p) => {
    const map = new Map<string, Entry>();
    for (const e of entriesFor(p)) {
      const key = `${e.group}|${normalize(e.label)}`;
      if (!map.has(key)) map.set(key, e);
    }
    return map;
  });

  const keys: string[] = [];
  for (const map of perPlace) {
    for (const key of map.keys()) if (!keys.includes(key)) keys.push(key);
  }

  const rows: CompareRow[] = keys.map((key) => {
    const entries = perPlace.map((m) => m.get(key) ?? null);
    const first = entries.find((e) => e !== null)!;
    return { group: first.group, label: first.label, cells: entries.map((e) => e?.cell ?? null) };
  });

  // Групите са в зададен ред; в рамките на група редът е от първото място, в което се срещат.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const g = GROUP_ORDER.indexOf(a.row.group) - GROUP_ORDER.indexOf(b.row.group);
      return g !== 0 ? g : a.index - b.index;
    })
    .map((x) => x.row);
}
