import type { ReportBlock } from "@/data/mock-report";

/** Мерни единици, които не се броят за „думи“ при решението кутийка / текст. */
const UNITS = new Set([
  "км", "м", "мин", "ч", "час", "часа", "часове", "%", "мм", "дка", "лв", "евро", "€", "души",
]);

/**
 * Заменя диапазони с една приблизителна стойност: „100–120 км“ → „~110 км“,
 * „35–40 мин“ → „~38 мин“. Годините (2021–2024) не се пипат.
 */
export function approximateRanges(input: string): string {
  return input.replace(
    /(?<![\p{L}\d.,])((?:около|приблизително|~)\s*)?(\d+(?:[.,]\d+)?)(?:\s*(?:км|м|мин|ч|%)\.?)?\s*[–—-]\s*(\d+(?:[.,]\d+)?)/gu,
    (match, _tilde: string | undefined, aRaw: string, bRaw: string) => {
      const a = parseFloat(aRaw.replace(",", "."));
      const b = parseFloat(bRaw.replace(",", "."));
      if (Number.isNaN(a) || Number.isNaN(b)) return match;
      const isYear = (n: number) => Number.isInteger(n) && n >= 1900 && n <= 2100;
      if (isYear(a) && isYear(b)) return match;
      const mid = (a + b) / 2;
      const rounded = mid >= 10 ? Math.round(mid) : Math.round(mid * 10) / 10;
      return `~${String(rounded).replace(".", ",")}`;
    },
  );
}

/** Кутийка е за числа или най-много 2 думи; всичко по-дълго отива в текст. */
export function isBoxValue(value: string): boolean {
  const tokens = value
    .replace(/[~≈/()·,;:+–—-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const words = tokens.filter(
    (t) => !/\d/.test(t) && !UNITS.has(t.toLowerCase().replace(/\.$/, "")),
  );
  return words.length <= 2;
}

/**
 * Оформление на категория „Инфраструктура“:
 *  - без пощенски код в кутийките (той е в заглавието на доклада);
 *  - кутийки само за числа / до 2 думи, с приблизителни стойности вместо диапазони;
 *  - всичко останало (описания, дълги стойности) се слива в свободен текст под кутийките.
 */
export function layoutBasicBlocks(blocks: ReportBlock[]): ReportBlock[] {
  const out: ReportBlock[] = [];
  const extraLines: string[] = [];

  for (const b of blocks) {
    if (b.kind === "facts") {
      const boxes: Extract<ReportBlock, { kind: "facts" }>["items"] = [];
      for (const it of b.items) {
        if (/пощенск/i.test(it.label)) continue;
        const value = approximateRanges(it.value);
        if (isBoxValue(value)) {
          boxes.push({
            label: it.label,
            value,
            ...(it.sources ? { sources: it.sources } : {}),
          });
          if (it.description) extraLines.push(`${it.label}: ${it.description}`);
        } else {
          extraLines.push(`${it.label}: ${value}${it.description ? ` — ${it.description}` : ""}`);
        }
      }
      if (boxes.length > 0) out.push({ kind: "facts", items: boxes });
    } else if (b.kind === "distances") {
      out.push({
        ...b,
        rows: b.rows.map((r) => ({
          ...r,
          distance: approximateRanges(r.distance),
          driveTime: approximateRanges(r.driveTime),
        })),
      });
    } else {
      out.push(b);
    }
  }

  if (extraLines.length > 0) {
    const idx = out.findIndex(
      (b) => b.kind === "text" && (!b.variant || b.variant === "default"),
    );
    if (idx >= 0) {
      const t = out[idx] as Extract<ReportBlock, { kind: "text" }>;
      out[idx] = { ...t, body: `${t.body}\n${extraLines.join("\n")}` };
    } else {
      out.push({ kind: "text", title: "Допълнителна информация", body: extraLines.join("\n") });
    }
  }
  return out;
}
