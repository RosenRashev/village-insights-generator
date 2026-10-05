import { z } from "zod";

import type { ReportBlock } from "@/data/mock-report";

/**
 * Валидация на блоковете, които връща Gemini. Моделът понякога връща число вместо низ,
 * null вместо липсващо поле или непозната стойност на enum — тук това се нормализира,
 * а блок, който не може да се спаси, се изхвърля, вместо да счупи цялата страница.
 */

const TONES = ["emerald", "sky", "blue", "amber", "violet", "purple", "rose", "teal"] as const;

const str = z.union([z.string(), z.number()]).transform((v) => String(v));
const optStr = str.nullish().transform((v) => v ?? undefined);

/** Заглавие със стойност по подразбиране — липсата му не бива да губи данните в блока. */
const titled = (fallback: string) => str.nullish().transform((v) => v ?? fallback);

const num = z.union([
  z.number().finite(),
  z
    .string()
    .regex(/^-?\d+([.,]\d+)?$/)
    .transform((s) => Number(s.replace(",", "."))),
]);
const optNum = num.nullish().transform((v) => v ?? undefined);
const percent = num.transform((n) => Math.max(0, Math.min(100, n))).catch(50);

const tone = z.enum(TONES).optional().catch(undefined);
const sources = z
  .array(z.object({ label: str, url: str }))
  .optional()
  .catch(undefined);

/** Масив, от който се изхвърлят невалидните елементи (вместо да се отхвърли целият блок). */
function lenientArray<T extends z.ZodTypeAny>(item: T) {
  return z.array(z.unknown()).transform((arr) =>
    arr.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success ? [r.data as z.infer<T>] : [];
    }),
  );
}

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  facts: z.object({
    title: optStr,
    featured: z.boolean().optional().catch(undefined),
    items: lenientArray(
      z.object({
        label: str,
        value: str,
        description: optStr,
        size: z.enum(["sm", "md"]).optional().catch(undefined),
        pillLabel: optStr,
        pillValue: optStr,
        sources,
      }),
    ),
  }),
  text: z.object({
    title: optStr,
    body: str,
    variant: z.enum(["default", "dark", "highlight", "alert"]).optional().catch(undefined),
    tone,
  }),
  list: z.object({ title: optStr, items: lenientArray(str), tone }),
  scale: z.object({
    title: optStr,
    items: lenientArray(
      z.object({
        label: str,
        level: z.enum(["good", "fair", "poor"]).catch("fair"),
        levelText: str,
        percent,
        note: str.catch(""),
        sources,
      }),
    ),
  }),
  distances: z.object({
    title: optStr,
    rows: lenientArray(
      z.object({
        to: str,
        distance: str,
        driveTime: str,
        hasTrain: z.boolean().optional().catch(undefined),
        road: optStr,
        info: optStr,
      }),
    ),
  }),
  gauge: z.object({
    title: titled("Тенденция"),
    value: num,
    direction: z.enum(["up", "down", "neutral"]).catch("neutral"),
    periodLabel: optStr,
    note: optStr,
  }),
  cards: z.object({
    title: optStr,
    items: lenientArray(
      z.object({
        icon: optStr,
        label: str,
        body: str,
        tone: z.enum(TONES).catch("emerald"),
      }),
    ),
  }),
  pie: z.object({
    title: titled("Разпределение"),
    note: optStr,
    data: lenientArray(z.object({ name: str, value: num })),
  }),
  bars: z.object({
    title: titled("Данни"),
    unit: optStr,
    note: optStr,
    data: lenientArray(z.object({ label: str, value: num })),
  }),
  schedule: z.object({
    title: titled("Разписание"),
    note: optStr,
    rows: lenientArray(z.object({ route: str, days: str, runs: str, last: str })),
  }),
  risks: z.object({
    title: titled("Оценка на рисковете"),
    items: lenientArray(
      z.object({
        label: str,
        level: z.enum(["low", "medium", "high"]).catch("medium"),
        note: optStr,
        percent: optNum,
        incidentCount: optNum,
        sources,
      }),
    ),
  }),
  checklist: z.object({
    title: optStr,
    items: lenientArray(z.object({ title: str, points: lenientArray(str) })),
  }),
};

/** Кое поле носи съдържанието на блока (за проверка, че не е празен). */
const CONTENT_FIELD: Record<string, string> = {
  facts: "items",
  text: "body",
  list: "items",
  scale: "items",
  distances: "rows",
  cards: "items",
  pie: "data",
  bars: "data",
  schedule: "rows",
  risks: "items",
  checklist: "items",
};

function hasContent(kind: string, block: Record<string, unknown>): boolean {
  if (kind === "gauge") return true;
  const field = CONTENT_FIELD[kind];
  if (!field) return false;
  const value = block[field];
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

/** Премахва `undefined` ключовете, за да отговаря на `exactOptionalPropertyTypes`. */
function compact(block: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(block).filter(([, v]) => v !== undefined));
}

function compactDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactDeep);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, compactDeep(v)]),
    );
  }
  return value;
}

export type ParsedBlocks = { blocks: ReportBlock[]; dropped: number };

/** Приема суровия `blocks` от Gemini и връща само валидните, нормализирани блокове. */
export function parseBlocks(raw: unknown): ParsedBlocks {
  const input = Array.isArray(raw) ? raw : [];
  const blocks: ReportBlock[] = [];
  let dropped = 0;

  for (const candidate of input) {
    const kind =
      typeof candidate === "object" && candidate !== null
        ? (candidate as { kind?: unknown }).kind
        : undefined;
    const schema = typeof kind === "string" ? SCHEMAS[kind] : undefined;
    const parsed = schema?.safeParse(candidate);
    if (!parsed?.success || typeof kind !== "string") {
      dropped += 1;
      continue;
    }
    const data = compact(parsed.data as Record<string, unknown>);
    if (!hasContent(kind, data)) {
      dropped += 1;
      continue;
    }
    blocks.push({ kind, ...(compactDeep(data) as object) } as unknown as ReportBlock);
  }

  return { blocks, dropped };
}

const SUMMARY_MAX = 200;

/** Резюмето на категорията: само текст, без излишни интервали, най-много ~200 знака. */
export function parseSummary(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (text.length <= SUMMARY_MAX) return text;
  const cut = text.slice(0, SUMMARY_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : SUMMARY_MAX).trim()}…`;
}
