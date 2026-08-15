import type { ReportSection } from "@/data/mock-report";
import type { Json } from "@/integrations/supabase/types";
import type { SourceLink } from "@/lib/report-cache";
import {
  PROMPT_MODULES,
  COMMON_RULES,
  DISTRICT_RULE,
  LEVEL_RULE,
} from "@/lib/prompt-modules";

export type GeneratedCategory = {
  data: Json;
  sourceLinks: SourceLink[] | null;
  incidentCount: number | null;
};

export type GenerateInput = {
  ekatte: number;
  categoryId: string;
  placeName: string;
  placeType: "village" | "town" | "district";
  currentLocationName?: string | undefined;
};

/** Модел с добър баланс цена/качество; ползва се и за двете стъпки. */
const MODEL = "gemini-3.5-flash-lite";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

const THEMES = [
  "emerald",
  "sky",
  "amber",
  "violet",
  "rose",
  "teal",
  "indigo",
  "orange",
  "lime",
  "cyan",
  "fuchsia",
  "slate",
] as const;

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  error?: { message?: string; code?: number };
};

function apiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("Липсва GEMINI_API_KEY в настройките на проекта.");
  return key;
}

async function callGemini(body: unknown): Promise<GeminiResponse> {
  const res = await fetch(`${API}/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GeminiResponse;
  if (!res.ok || json.error) {
    throw new Error(
      `Gemini API грешка (${res.status}): ${json.error?.message ?? "неизвестна грешка"}`,
    );
  }
  return json;
}

function textOf(res: GeminiResponse): string {
  return (res.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function sourcesOf(res: GeminiResponse): SourceLink[] {
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const links: SourceLink[] = [];
  for (const c of chunks) {
    const url = c.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push({ label: c.web?.title ?? new URL(url).hostname, url });
  }
  return links.slice(0, 12);
}

/** Изчиства markdown огради и излишен текст около JSON обекта. */
function extractJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s;
}

const PLACE_TYPE_LABEL: Record<GenerateInput["placeType"], string> = {
  village: "село",
  town: "малък град",
  district: "квартал на голям град",
};

function moduleSection(categoryId: string): string {
  const mod = PROMPT_MODULES.find((m) => m.id === categoryId);
  if (!mod) throw new Error(`Непозната категория: ${categoryId}`);
  return mod.section;
}

function moduleLabel(categoryId: string): string {
  return PROMPT_MODULES.find((m) => m.id === categoryId)?.label ?? categoryId;
}

type PlaceIdentity = {
  name: string;
  municipality: string | null;
  province: string | null;
  postalCode: string | null;
  ekatte: string;
};

/** Еднозначна идентификация по ЕКАТТЕ от официалния списък на населените места. */
async function placeIdentity(input: GenerateInput): Promise<PlaceIdentity> {
  const { loadSettlements } = await import("@/lib/settlements");
  const all = await loadSettlements();
  const match = all.find((s) => s.ekatte === input.ekatte);
  return {
    name: match?.name ? `${match.isVillage ? "с." : "гр."} ${match.name}` : input.placeName,
    municipality: match?.municipality ?? null,
    province: match?.province ?? null,
    postalCode: match?.postalCode ?? null,
    ekatte: String(input.ekatte).padStart(5, "0"),
  };
}

function identityBlock(id: PlaceIdentity): string {
  const lines = [`Наименование: ${id.name}`];
  if (id.municipality) lines.push(`Община: ${id.municipality}`);
  if (id.province) lines.push(`Област: ${id.province}`);
  if (id.postalCode) lines.push(`Пощенски код: ${id.postalCode}`);
  lines.push(`ЕКАТТЕ: ${id.ekatte}`);
  return lines.join("\n");
}

function anchorRule(id: PlaceIdentity): string {
  const full = [
    id.name,
    id.municipality ? `община ${id.municipality}` : null,
    id.province ? `област ${id.province}` : null,
    `ЕКАТТЕ ${id.ekatte}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `КРИТИЧНО ВАЖНО — ЕДНОЗНАЧНА ИДЕНТИФИКАЦИЯ:
В България има няколко населени места със същото име. Проучваш ЕДИНСТВЕНО: ${full}.
- Всяко търсене формулирай с пълната комбинация име + община + област (напр. „${id.name} община ${id.municipality ?? ""} област ${id.province ?? ""}“).
- Игнорирай напълно едноименни населени места в други общини и области — не смесвай техни данни.
- Ако намерен източник се отнася за друга община/област, отхвърли го.
- Навсякъде в отговора посочвай община ${id.municipality ?? "—"} и област ${id.province ?? "—"}; никога друга община.`;
}

/** Стъпка 1: грундирано (Google Search) текстово проучване за ЕДНА категория. */
async function researchCategory(
  input: GenerateInput,
  id: PlaceIdentity,
): Promise<{
  text: string;
  sources: SourceLink[];
}> {
  const prompt = `Ти си прецизен изследовател на български населени места. Работиш САМО с проверими публични източници (НСИ, ГРАО, общински сайтове, ВиК оператори, ЕРП, медии) и търсене в Google в реално време.

ОБЕКТ НА ПРОУЧВАНЕТО:
Тип: ${PLACE_TYPE_LABEL[input.placeType]}
${identityBlock(id)}
${input.currentLocationName ? `Настояща локация на потребителя: ${input.currentLocationName}` : ""}

${anchorRule(id)}

Проучи САМО следната тема и нищо друго:

${moduleSection(input.categoryId)}

${input.placeType === "district" ? DISTRICT_RULE : LEVEL_RULE}

${COMMON_RULES}

ПРАВИЛА:
- Не измисляй факти. При липса на данни пиши изрично „Няма налични публични данни“.
- Ако данните са на общинско/областно ниво, отбележи го (община ${id.municipality ?? "—"}, област ${id.province ?? "—"}).
- Числата давай конкретно (проценти, километри, минути, брой).
- В края добави списък „ИЗТОЧНИЦИ:“ с пълни URL адреси на използваните страници.
- Пиши на български, кратко и фактологично.`;


  const res = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  });

  const text = textOf(res);
  if (!text) throw new Error("Gemini върна празен отговор при проучването.");
  return { text, sources: sourcesOf(res) };
}

const SCHEMA_DOC = `Върни САМО JSON обект със следната структура (без markdown огради):
{
  "title": string,                       // кратко заглавие на секцията на български
  "subtitle": string,                    // едно изречение пояснение
  "blocks": Block[],                     // 2 до 5 блока
  "incidentCount": number | null         // само за категория "risks": брой регистрирани рискови събития, иначе null
}
Block е един от:
{"kind":"facts","items":[{"label":string,"value":string}]}                    // 2-6 кратки факта
{"kind":"text","title":string,"body":string}
{"kind":"list","title":string,"items":string[]}
{"kind":"pie","title":string,"note":string,"data":[{"name":string,"value":number}]}   // value = процент, сборът ~100
{"kind":"schedule","title":string,"note":string,"rows":[{"route":string,"days":string,"runs":string,"last":string}]}
{"kind":"risks","title":string,"items":[{"label":string,"level":"low"|"medium"|"high","note":string,"incidentCount":number}]}
{"kind":"checklist","title":string,"items":[{"title":string,"points":string[]}]}
Използвай "pie" само при реални процентни разпределения, "schedule" само за транспортни разписания,
"risks" само за рискови оценки, "checklist" само за списъци със стъпки за оглед.`;

/** Стъпка 2: структуриране на грундирания текст в нашия JSON формат (без tools). */
async function structureCategory(
  input: GenerateInput,
  research: string,
): Promise<{ section: Omit<ReportSection, "id" | "theme">; incidentCount: number | null }> {
  const prompt = `Структурирай следния готов изследователски текст за „${input.placeName}“ (тема: ${moduleLabel(
    input.categoryId,
  )}) в JSON за визуална инфографика.

${SCHEMA_DOC}

Не добавяй факти, които ги няма в текста. Не включвай URL адреси в стойностите.

ТЕКСТ:
"""
${research}
"""`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  };

  let raw = textOf(await callGemini(body));
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    // Един повторен опит с изрична инструкция за чист JSON.
    raw = textOf(
      await callGemini({
        ...body,
        contents: [
          {
            role: "user",
            parts: [{ text: `${prompt}\n\nВАЖНО: върни само валиден JSON, без обяснения.` }],
          },
        ],
      }),
    );
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      throw new Error(
        `Не можах да структурирам отговора за категория „${input.categoryId}“ — невалиден JSON от модела.`,
      );
    }
  }

  const obj = parsed as {
    title?: string;
    subtitle?: string;
    blocks?: unknown;
    incidentCount?: unknown;
  };
  const blocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  if (blocks.length === 0) {
    throw new Error(`Моделът не върна съдържание за категория „${input.categoryId}“.`);
  }

  return {
    section: {
      title: obj.title ?? moduleLabel(input.categoryId),
      subtitle: obj.subtitle ?? "",
      blocks: blocks as ReportSection["blocks"],
    },
    incidentCount: typeof obj.incidentCount === "number" ? obj.incidentCount : null,
  };
}

function themeFor(categoryId: string): ReportSection["theme"] {
  const idx = PROMPT_MODULES.findIndex((m) => m.id === categoryId);
  return THEMES[(idx < 0 ? 0 : idx) % THEMES.length]!;
}

/**
 * Генерира една категория от доклада чрез Gemini с Google Search grounding.
 * Двустъпков подход: (1) грундирано проучване, (2) структуриране в нашия JSON.
 */
export async function generateCategory(input: GenerateInput): Promise<GeneratedCategory> {
  const research = await researchCategory(input);
  const { section, incidentCount } = await structureCategory(input, research.text);

  const full: ReportSection = {
    id: input.categoryId,
    title: section.title,
    ...(section.subtitle ? { subtitle: section.subtitle } : {}),
    theme: themeFor(input.categoryId),
    blocks: section.blocks,
  };

  const risks =
    input.categoryId === "risks"
      ? (full.blocks.find((b) => b.kind === "risks") as
          | Extract<ReportSection["blocks"][number], { kind: "risks" }>
          | undefined)
      : undefined;

  const derivedIncidents =
    incidentCount ??
    (risks ? risks.items.reduce((sum, r) => sum + (r.incidentCount ?? 0), 0) || null : null);

  return {
    data: full as unknown as Json,
    sourceLinks: research.sources.length > 0 ? research.sources : null,
    incidentCount: derivedIncidents,
  };
}

/**
 * „Живата“ част за категория basic: разстояние и време с автомобил до настоящата локация.
 * Не се кешира — зависи от избраната от потребителя настояща локация.
 */
export async function generateDistanceToCurrent(
  placeName: string,
  currentLocationName: string,
): Promise<{ block: Json; sources: SourceLink[] }> {
  const res = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Изчисли пътуването с автомобил от „${currentLocationName}“ до „${placeName}“ (България).
Върни САМО JSON: {"distanceKm":string,"driveTime":string,"route":string}
distanceKm — напр. "38 км"; driveTime — напр. "35–40 мин"; route — кратко описание на основните пътища (едно изречение).`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
  });

  const raw = extractJson(textOf(res));
  let parsed: { distanceKm?: string; driveTime?: string; route?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Не можах да изчисля разстоянието до настоящата локация.");
  }

  return {
    block: {
      kind: "facts",
      items: [
        { label: "Разстояние по път", value: parsed.distanceKm ?? "—" },
        { label: "Време с кола", value: parsed.driveTime ?? "—" },
        { label: "От", value: currentLocationName },
        { label: "Маршрут", value: parsed.route ?? "—" },
      ],
    } as unknown as Json,
    sources: sourcesOf(res),
  };
}
