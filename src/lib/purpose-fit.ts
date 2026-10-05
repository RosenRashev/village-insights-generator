import type { ReportBlock, ReportSection } from "@/data/mock-report";
import type { PurposeId } from "@/lib/prompt-modules";

/**
 * Оценка „доколко е подходящо за <цел>“ (1–10).
 *
 * Докладът пази целево-независими СИГНАЛИ: за всяка тема (болница, интернет, цени…) Gemini
 * дава обективна оценка 1–10 (10 = много добре) и увереност. Целта е само филтър при показване:
 * всяка цел има собствени тегла по теми, така че един и същ доклад може да се оцени за
 * „инвестиция“ и за „възрастни хора“ без нови заявки.
 *
 * Принципи: липсата на данни не е минус (теглото ѝ не влиза в средната), а оскъдните данни
 * дърпат оценката към неутрални 5,5 и намаляват увереността.
 */

export const TOPICS = {
  price_level: "достъпност на цените на имотите",
  price_trend: "тенденция на цените / растеж",
  demand: "пазарно търсене и ликвидност",
  development: "инвестиции и развитие на района",
  jobs: "работни места и местна икономика",
  demographics: "жизненост на населението",
  healthcare: "лекар, болница, спешна помощ",
  pharmacy: "аптека",
  education: "детска градина и училище",
  services: "магазини и ежедневни услуги",
  transport_public: "обществен транспорт",
  road_access: "пътища и достъп до големи градове",
  internet: "интернет и мобилна мрежа",
  power: "електрозахранване",
  water: "вода и канализация",
  quiet: "тишина и спокойствие",
  safety: "сигурност",
  nature: "природа и чист въздух",
  attractions: "забележителности и туризъм",
  community: "общност и съседство",
  culture_life: "културен и обществен живот",
  hazards: "защита от природни рискове",
} as const;

export type TopicId = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as TopicId[];

export type Signal = {
  topic: TopicId;
  /** 1–10, 10 = много добре (независимо от целта). */
  score: number;
  /** 0.3–1: колко надеждна е информацията. */
  confidence: number;
  /** Кратко пояснение (какво стои зад оценката). */
  note?: string;
};

/** Теглата (0–3) показват колко важна е темата за дадена цел; липсваща тема не се брои. */
export const PURPOSE_WEIGHTS: Record<PurposeId, Partial<Record<TopicId, number>>> = {
  investor: {
    price_level: 2,
    price_trend: 3,
    demand: 3,
    development: 3,
    jobs: 2,
    demographics: 2,
    road_access: 2,
    transport_public: 1,
    internet: 1,
    power: 1.5,
    water: 1.5,
    services: 1,
    hazards: 1.5,
    attractions: 1,
    safety: 1,
  },
  retirees: {
    healthcare: 3,
    pharmacy: 2.5,
    transport_public: 2.5,
    quiet: 2.5,
    safety: 2.5,
    services: 2,
    community: 2,
    nature: 2,
    water: 2,
    power: 1.5,
    price_level: 1.5,
    hazards: 1.5,
    internet: 0.5,
    road_access: 1,
  },
  family: {
    education: 3,
    safety: 3,
    healthcare: 2.5,
    services: 2,
    transport_public: 1.5,
    road_access: 1.5,
    nature: 2,
    community: 1.5,
    internet: 1.5,
    jobs: 1.5,
    quiet: 1.5,
    water: 1.5,
    power: 1.5,
    price_level: 1.5,
    hazards: 1,
    culture_life: 1,
  },
  weekend: {
    nature: 3,
    attractions: 2.5,
    road_access: 3,
    quiet: 2.5,
    safety: 2.5,
    price_level: 2,
    hazards: 1.5,
    culture_life: 1.5,
    services: 1,
    water: 1,
    power: 1,
    internet: 0.5,
    community: 1,
  },
  remote: {
    internet: 3,
    power: 3,
    quiet: 2,
    road_access: 2,
    services: 2,
    healthcare: 1.5,
    safety: 1.5,
    community: 1.5,
    nature: 1.5,
    water: 1.5,
    price_level: 1.5,
    transport_public: 1,
  },
};

const PRIOR = 5.5;
/** „Псевдо-тегло“ на неутралната оценка — колкото по-малко данни, толкова по-силно дърпа към 5,5. */
const PRIOR_WEIGHT = 1.5;
const MIN_COVERAGE = 0.2;

const clampScore = (n: number) => Math.max(1, Math.min(10, n));

/** Валидира суровите `signals` от Gemini: непознати теми и невалидни числа се изхвърлят. */
export function parseSignals(raw: unknown): Signal[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Map<TopicId, Signal>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as { topic?: unknown; score?: unknown; confidence?: unknown; note?: unknown };
    const topic = o.topic;
    if (typeof topic !== "string" || !(topic in TOPICS)) continue;
    const score = typeof o.score === "number" ? o.score : Number(o.score);
    if (!Number.isFinite(score)) continue;
    const conf = typeof o.confidence === "number" ? o.confidence : Number(o.confidence);
    const note = typeof o.note === "string" ? o.note.replace(/\s+/g, " ").trim().slice(0, 140) : "";
    const signal: Signal = {
      topic: topic as TopicId,
      score: clampScore(score),
      confidence: Number.isFinite(conf) ? Math.max(0.3, Math.min(1, conf)) : 0.6,
      ...(note ? { note } : {}),
    };
    // При повторение на тема печели по-уверената оценка.
    const prev = seen.get(signal.topic);
    if (!prev || signal.confidence > prev.confidence) seen.set(signal.topic, signal);
  }
  return [...seen.values()];
}

type Weighted = { signal: Signal; weight: number };

function weigh(signals: Signal[], purpose: PurposeId): Weighted[] {
  const weights = PURPOSE_WEIGHTS[purpose];
  return signals.flatMap((signal) => {
    const weight = weights[signal.topic] ?? 0;
    return weight > 0 ? [{ signal, weight }] : [];
  });
}

/** Средна оценка със свиване към неутралната; `null` при липса на релевантни сигнали. */
function shrunkScore(items: Weighted[]): { score: number; weight: number } | null {
  if (items.length === 0) return null;
  let sum = 0;
  let w = 0;
  for (const { signal, weight } of items) {
    const eff = weight * signal.confidence;
    sum += eff * signal.score;
    w += eff;
  }
  return { score: (sum + PRIOR_WEIGHT * PRIOR) / (w + PRIOR_WEIGHT), weight: w };
}

export type Verdict = "great" | "good" | "mixed" | "weak";

export function verdictOf(score: number): Verdict {
  if (score >= 7.5) return "great";
  if (score >= 6.3) return "good";
  if (score >= 5) return "mixed";
  return "weak";
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  great: "Много подходящо",
  good: "Подходящо",
  mixed: "Със резерви",
  weak: "Слабо подходящо",
};

export type PurposeFit = {
  /** `null` — недостатъчно данни за оценка. */
  score: number | null;
  verdict: Verdict | null;
  /** Дял от важните за целта теми, за които има данни (0–1). */
  coverage: number;
  confidence: "high" | "medium" | "low";
  pros: Signal[];
  cons: Signal[];
  /** Важни за целта теми, за които липсват данни — „проверете на място“. */
  unknown: TopicId[];
};

export function collectSignals(sections: ReportSection[]): Signal[] {
  const best = new Map<TopicId, Signal>();
  for (const s of sections) {
    for (const signal of s.signals ?? []) {
      const prev = best.get(signal.topic);
      if (!prev || signal.confidence > prev.confidence) best.set(signal.topic, signal);
    }
  }
  return [...best.values()];
}

export function computeFit(signals: Signal[], purpose: PurposeId): PurposeFit {
  const weights = PURPOSE_WEIGHTS[purpose];
  const items = weigh(signals, purpose);
  const totalWeight = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  const covered = items.reduce((a, i) => a + i.weight, 0);
  const coverage = totalWeight > 0 ? covered / totalWeight : 0;
  const have = new Set(items.map((i) => i.signal.topic));

  const unknown = (Object.entries(weights) as [TopicId, number][])
    .filter(([topic, w]) => w >= 2 && !have.has(topic))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic]) => topic);

  const impact = ({ signal, weight }: Weighted) => weight * Math.abs(signal.score - PRIOR);
  const pros = items
    .filter((i) => i.signal.score >= 7 && i.weight >= 1)
    .sort((a, b) => impact(b) - impact(a))
    .slice(0, 5)
    .map((i) => i.signal);
  const cons = items
    .filter((i) => i.signal.score <= 4 && i.weight >= 1)
    .sort((a, b) => impact(b) - impact(a))
    .slice(0, 5)
    .map((i) => i.signal);

  const confidence = coverage >= 0.6 ? "high" : coverage >= 0.35 ? "medium" : "low";
  const shrunk = coverage >= MIN_COVERAGE ? shrunkScore(items) : null;
  const score = shrunk ? Math.round(shrunk.score * 10) / 10 : null;
  return {
    score,
    verdict: score === null ? null : verdictOf(score),
    coverage,
    confidence,
    pros,
    cons,
    unknown,
  };
}

/** Оценка само по сигналите на една категория (за значка в заглавието); `null` при малко данни. */
export function sectionScore(section: ReportSection, purpose: PurposeId): number | null {
  const items = weigh(section.signals ?? [], purpose);
  const shrunk = shrunkScore(items);
  if (!shrunk || shrunk.weight < 1.5) return null;
  return Math.round(shrunk.score * 10) / 10;
}

export const PURPOSE_FIT_ID = "purpose-fit";

const line = (s: Signal) =>
  `${TOPICS[s.topic][0]!.toUpperCase()}${TOPICS[s.topic].slice(1)}${s.note ? ` — ${s.note}` : ""}`;

export function summaryText(fit: PurposeFit, purposeLabel: string): string {
  if (fit.score === null || fit.verdict === null) {
    return `За цел „${purposeLabel}“ в доклада няма достатъчно данни за надеждна оценка — това не е лош знак, а липса на информация. Проверете на място посочените теми.`;
  }
  const head = `${VERDICT_TEXT[fit.verdict]} за „${purposeLabel}“ — ${fit.score.toFixed(1)} от 10`;
  const tail =
    fit.confidence === "high"
      ? "."
      : fit.confidence === "medium"
        ? " (оценката е на база част от темите)."
        : " (ориентировъчно: данните са малко, а липсата на данни не се брои като минус).";
  const pros = fit.pros.slice(0, 2).map((s) => TOPICS[s.topic]);
  const cons = fit.cons.slice(0, 2).map((s) => TOPICS[s.topic]);
  const parts = [
    pros.length ? `Силни страни: ${pros.join(", ")}.` : "",
    cons.length ? `Слаби страни: ${cons.join(", ")}.` : "",
  ].filter(Boolean);
  return [head + tail, ...parts].join(" ");
}

/** Финалната категория „За <цел>“ — съставена от стандартните блокове. */
export function buildPurposeSection(
  sections: ReportSection[],
  purpose: PurposeId,
  purposeLabel: string,
): ReportSection {
  const signals = collectSignals(sections);
  const fit = computeFit(signals, purpose);
  const blocks: ReportBlock[] = [];

  blocks.push({ kind: "text", title: "Обобщение", body: summaryText(fit, purposeLabel) });
  if (fit.score !== null && fit.verdict !== null) {
    blocks.push({
      kind: "facts",
      title: "Оценка",
      items: [
        {
          label: "Оценка",
          value: `${fit.score.toFixed(1)} / 10`,
          description: VERDICT_TEXT[fit.verdict],
        },
        {
          label: "Надеждност",
          value: { high: "Висока", medium: "Средна", low: "Ниска" }[fit.confidence],
          description: `Налични данни за ${Math.round(fit.coverage * 100)}% от важните теми`,
        },
      ],
    });
  }
  if (fit.pros.length) {
    blocks.push({ kind: "list", title: "Плюсове", tone: "emerald", items: fit.pros.map(line) });
  }
  if (fit.cons.length) {
    blocks.push({ kind: "list", title: "Минуси", tone: "rose", items: fit.cons.map(line) });
  }
  if (fit.unknown.length) {
    blocks.push({
      kind: "list",
      title: "Липсват данни — проверете на място",
      tone: "amber",
      items: fit.unknown.map((t) => `${TOPICS[t][0]!.toUpperCase()}${TOPICS[t].slice(1)}`),
    });
  }

  return {
    id: PURPOSE_FIT_ID,
    title: `За „${purposeLabel}“`,
    subtitle: "Оценка на докладваните данни спрямо избраната цел",
    theme: "indigo",
    blocks,
    ...(fit.score !== null && fit.verdict
      ? { summary: summaryText(fit, purposeLabel).split(". ")[0]! }
      : {}),
  };
}

/** Вмъква финалната категория точно преди чеклиста за проверка на място. */
export function withPurposeSection(
  sections: ReportSection[],
  purpose: PurposeId | null,
  purposeLabel: string,
): ReportSection[] {
  const base = sections.filter((s) => s.id !== PURPOSE_FIT_ID);
  if (!purpose) return base;
  const fit = buildPurposeSection(base, purpose, purposeLabel);
  const idx = base.findIndex((s) => s.id === "onsite-checklist");
  return idx < 0 ? [...base, fit] : [...base.slice(0, idx), fit, ...base.slice(idx)];
}
