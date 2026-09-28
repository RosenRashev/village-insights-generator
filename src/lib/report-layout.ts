import type { CardTone, ReportBlock } from "@/data/mock-report";

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

const TRANSPORT_RE =
  /разстоян|отстоян|летищ|гар[аи]|жп|железопът|път|артери|магистрал|време|автомоб|км|мин|курорт|бани|язовир|възел|възли|транспорт|обходен|посока/i;

/** Стойност, която говори за пътуване: „18 минути“, „до 40 км“, „с автомобил“, „с влак“. */
const TRAVEL_RE = /(\d|час|минут)\s*(км|мин|ч\b|час|минут)|автомобил|влак/i;

/** Цвят на подкатегория според заглавието ѝ. */
function toneFor(title?: string): CardTone {
  const t = title ?? "";
  if (/транспорт|път|разстоян|отстоян|летищ|гар/i.test(t)) return "sky";
  if (/отзвук|популярн|известн/i.test(t)) return "violet";
  if (/вещноправ|сервитут|ограничен/i.test(t)) return "amber";
  return "emerald";
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
    } else if (b.kind === "text" && (!b.variant || b.variant === "default")) {
      out.push({ ...b, tone: b.tone ?? toneFor(b.title) });
    } else if (b.kind === "list") {
      out.push({ ...b, tone: b.tone ?? toneFor(b.title) });
    } else {
      out.push(b);
    }
  }

  // Остатъчната информация се разделя: разстояния/транспорт отделно от останалото.
  const transport = extraLines.filter(
    (l) => TRANSPORT_RE.test(l.split(":")[0] ?? l) || TRAVEL_RE.test(l),
  );
  const place = extraLines.filter((l) => !transport.includes(l));
  if (place.length > 0) {
    out.push({ kind: "text", title: "Релеф и местоположение", body: place.join("\n"), tone: "emerald" });
  }
  if (transport.length > 0) {
    out.push({ kind: "text", title: "Транспорт и разстояния", body: transport.join("\n"), tone: "sky" });
  }
  return out;
}
