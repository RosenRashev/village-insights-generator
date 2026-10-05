import type { ReportSection } from "@/data/mock-report";
import { approximateRanges, isBoxValue } from "@/lib/report-layout";

/**
 * До 3 кратки етикета за свития вид на категория — само от данните в доклада (без заявки):
 * първо оценките (скали), после тенденция, най-сериозния риск и накрая първите кутийки.
 */

export type SummaryChip = { text: string; level?: "good" | "fair" | "poor" };

const MAX_CHIP = 38;
const NO_DATA_RE = /няма\s+(налични|публични|данни|информация)|не е посочен|неизвестн/i;

const RISK_TEXT = { low: "нисък", medium: "среден", high: "висок" } as const;
const RISK_LEVEL = { low: "good", medium: "fair", high: "poor" } as const;

function short(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > MAX_CHIP ? `${t.slice(0, MAX_CHIP - 1).trim()}…` : t;
}

export function summaryChips(section: ReportSection, max = 3): SummaryChip[] {
  const scales: SummaryChip[] = [];
  const trends: SummaryChip[] = [];
  const risks: SummaryChip[] = [];
  const facts: SummaryChip[] = [];

  for (const block of section.blocks) {
    switch (block.kind) {
      case "scale":
        for (const it of block.items) {
          if (it.levelText.trim()) scales.push({ text: short(it.levelText), level: it.level });
        }
        break;

      case "gauge": {
        const sign = block.direction === "down" ? "−" : block.direction === "up" ? "+" : "";
        trends.push({
          text: short(`${block.title}: ${sign}${block.value}%`),
          ...(block.direction === "up"
            ? { level: "good" as const }
            : block.direction === "down"
              ? { level: "poor" as const }
              : {}),
        });
        break;
      }

      case "bars": {
        const first = block.data[0];
        const last = block.data[block.data.length - 1];
        if (first && last && first !== last) {
          trends.push({
            text: short(`${first.value} → ${last.value}`),
            level: last.value >= first.value ? "good" : "poor",
          });
        }
        break;
      }

      case "risks": {
        const worst = [...block.items].sort(
          (a, b) =>
            ({ low: 0, medium: 1, high: 2 })[b.level] - { low: 0, medium: 1, high: 2 }[a.level],
        )[0];
        if (worst) {
          risks.push({
            text: short(`${worst.label}: ${RISK_TEXT[worst.level]}`),
            level: RISK_LEVEL[worst.level],
          });
        }
        break;
      }

      case "facts":
        for (const it of block.items) {
          const value = approximateRanges(it.value);
          if (!value.trim() || NO_DATA_RE.test(value) || !isBoxValue(value)) continue;
          facts.push({ text: short(`${it.label}: ${value}`) });
        }
        break;

      default:
        break;
    }
  }

  return [...scales, ...trends, ...risks, ...facts].slice(0, max);
}
