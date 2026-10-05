import type { ReportSection } from "@/data/mock-report";
import type { Json } from "@/integrations/supabase/types";
import type { SourceLink } from "@/lib/report-cache";
import { parseBlocks } from "@/lib/report-schema";
import { PROMPT_MODULES, COMMON_RULES, DISTRICT_RULE, LEVEL_RULE } from "@/lib/prompt-modules";

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
};

/** Модел за грундираното (Google Search) проучване — тук качеството на search резултатите има значение. */
const MODEL = "gemini-3.5-flash-lite";
/**
 * Модел за чисто форматиране на вече готов текст в JSON — не ползва search.
 * gemini-2.5-flash-lite вече не е достъпен за нови проекти (404), затова ползваме 3.5-flash-lite.
 */
const STRUCTURE_MODEL = "gemini-3.5-flash-lite";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Максимално време за една заявка към Gemini (търсенето в Google може да е бавно). */
const REQUEST_TIMEOUT_MS = 90_000;

async function callGemini(body: unknown, model: string = MODEL): Promise<GeminiResponse> {
  const MAX_ATTEMPTS = 4;
  const MAX_TIMEOUTS = 2;
  let timeouts = 0;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = false;
    try {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // Отговорът при грешка не винаги е JSON (напр. HTML страница от прокси).
      const rawText = await res.text();
      let json: GeminiResponse;
      try {
        json = JSON.parse(rawText) as GeminiResponse;
      } catch {
        json = { error: { message: rawText.slice(0, 200) || "празен отговор" } };
      }

      if (res.ok && !json.error) return json;

      retryable = res.status === 429 || res.status === 503;
      lastError = new Error(
        `Gemini API грешка (${res.status}): ${json.error?.message ?? "неизвестна грешка"}`,
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        timeouts += 1;
        retryable = timeouts < MAX_TIMEOUTS;
        lastError = new Error("Gemini API не отговори навреме. Опитайте отново.");
      } else if (err instanceof TypeError) {
        // Мрежова грешка (fetch failed) — рядко, но си струва един повторен опит.
        retryable = true;
        lastError = new Error("Мрежова грешка при връзката с Gemini API.");
      } else {
        throw err;
      }
    }

    if (!retryable || attempt === MAX_ATTEMPTS) throw lastError;

    // Експоненциално изчакване преди следващия опит (1.5s, 3s, 6s...).
    await sleep(1500 * 2 ** (attempt - 1));
  }

  throw lastError ?? new Error("Gemini API грешка: неуспешен опит.");
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
  s = s
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
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

/** Специфично оформление за категория „basic“ (Инфраструктура). */
const BASIC_LAYOUT = `СПЕЦИАЛНИ ПРАВИЛА ЗА ТАЗИ КАТЕГОРИЯ — блоковете са точно в този ред:
1. ЕДИН блок "facts" с ключови числови показатели, ТОЧНО в този ред: (1) надморска височина, label "Надм. височина"; (2) разстояние до най-близкия областен град, label "До <име на града>"; (3) разстояние до най-близкото гражданско летище, label "До летище <име>"; след тях по избор: време с кола до областния град (label "Време с кола до <град>") и разстояние до най-близката автомагистрала. Всяка стойност е число с мерна единица или най-много 2 думи (напр. "~38 км"). Без "description". НЕ включвай пощенски код и ЕКАТТЕ.
2. ЕДИН блок "distances" — таблица с всички места от текста (областен град, най-близка автомагистрала, летища, жп гара, курорти, язовири, бани, забележителности). За всеки ред: разстояние, време с кола, hasTrain (само дали има влакова връзка) и номера на пътищата.
3. Няколко отделни блока "text" (по един за тема, всеки със "tone"), абзаците вътре са разделени с нов ред и започват с етикет и двоеточие (напр. "Релеф: ..."). Всяка тема се пише като пълни изречения, не като откъслечни фрази:
   - title "Релеф и местоположение", tone "emerald" — релеф, надморска височина, разположение спрямо близките градове;
   - title "Транспорт и пътна свързаност", tone "sky" — пътища, артерии, състояние на пътищата (само това, което НЕ е вече в таблицата);
   - title "Социален отзвук и популярност", tone "violet" — САМО ако има конкретна информация;
   - title "Вещноправни ограничения и сервитути", tone "amber" — ако има такива.
   Разстоянията и транспортът НЕ се смесват с останалите теми. Без "list" и други блокове.
Във всички числа давай ЕДНА приблизителна стойност (напр. "~110 км", "~40 мин"), никога диапазон като "100–120 км".`;

/** Специфично оформление за категория „vik“ (Водоснабдяване и канализация). */
const VIK_LAYOUT = `СПЕЦИАЛНИ ПРАВИЛА ЗА ТАЗИ КАТЕГОРИЯ — блоковете са точно в този ред:
1. ЕДИН блок "scale" с ТОЧНО 2 елемента, в този ред: (1) label "Качество на питейната вода" — оценка на база твърдост/хлориране/замърсявания; (2) label "Стабилност на водоснабдяването" — оценка на база чести аварии, сезонни спирания, ниско налягане. За всеки: "level" според тежестта (good = добро/стабилно, fair = има забележки, poor = сериозен проблем), "levelText" е кратка дума/фраза (до 3 думи), "note" е пълно описателно изречение с конкретика (не повтаряй "note" от единия елемент в другия).
2. ЕДИН блок "facts" с кратки показатели, ТОЧНО в този ред: (1) label "Качество на водата", value е САМО 1–2 думи, обобщаващи levelText от скалата по-горе (напр. "Твърда", "Добро", "С хлор"); (2) покритие на водопровода (%); (3) оператор; (4) канализация (има/липсва, максимум 2 думи); (5) дълбочина на подземните води (приблизителна стойност, напр. "~20 м"). Без "description", без дълги стойности.
3. По избор: блок "list" за останалите технически детайли от текста, които НЕ са вече казани в блока "scale" (без повторение на изреченията от "note").
4. Ако има конкретен риск от наводнения/отводняване — блок "risks".
Числа като диапазон замести с ЕДНА приблизителна стойност (напр. "~20 м", не "12–30 м").`;

/** Специфично оформление за категория „transport“ (Пътна мрежа и обществен транспорт). */
const TRANSPORT_LAYOUT = `СПЕЦИАЛНИ ПРАВИЛА ЗА ТАЗИ КАТЕГОРИЯ — блоковете са точно в този ред:
1. ЕДИН блок "facts" с кратки показатели, ТОЧНО в този ред: (1) "Асфалтирани улици" — процент (напр. "~80%"); (2) "Изходи от селото" — брой (число); (3) "Главна улица" — само името, до 2–3 думи; (4) "Автогара" — "Да" / "Няма"; (5) "ЖП спирка в селото" — "Да" / "Няма". Без "description", без дълги стойности.
2. ЕДИН блок "scale" с ТОЧНО 2 елемента: (1) label "Пътна мрежа в населеното място" — оценка на база % асфалт и общо състояние; (2) label "Изходите от населеното място" — оценка на база броя и състоянието им. Всеки с "level" (good/fair/poor), "levelText" (кратка дума/фраза до 3 думи) и пълно описателно "note".
3. ЕДИН блок "list" с title "Изходи от населеното място" — по един елемент за всеки изход: накъде води, по какъв път/тип път.
4. ЕДИН блок "list" с title "Улична мрежа" — брой и статус на главните улици, улично осветление, останали детайли за вътрешните улици.
5. Блокове "list" за зимна поддръжка и снабдяване (без промяна в обхвата).
6. Блокове "schedule" и обществен транспорт (без промяна в обхвата).
Числа като диапазон замести с ЕДНА приблизителна стойност.`;

/** Специфично оформление за категория „ethnos“ (Демография). */
const ETHNOS_LAYOUT = `СПЕЦИАЛНИ ПРАВИЛА ЗА ТАЗИ КАТЕГОРИЯ — блоковете са точно в този ред:
1. ЕДИН блок "gauge" (Демографски тренд) — най-отгоре.
2. ЕДИН блок "facts" с кратки проценти: постоянно живущи, под 18 г., над 65 г., с висше образование.
3. ЗАДЪЛЖИТЕЛНО, БЕЗ ИЗКЛЮЧЕНИЕ, ЕДИН блок "pie" (заглавие "Етнически състав") с ТОЧНО 4 елемента в "data" — "Българи", "Турци", "Роми", "Други" — НЕ добавяй пета група и НЕ ползвай „Недекларирали“/„Не са отговорили“ — тях включи в „Други“; с реални или обосновано приблизителни процентни стойности, които се сборуват до 100. ТОВА Е НАЙ-ВАЖНОТО ИЗИСКВАНЕ В ТАЗИ КАТЕГОРИЯ — отговорът е невалиден без този блок. Ако липсват каквито и да е публични данни дори на общинско ниво, дай собствена обоснована приблизителна оценка (напр. на база съседни населени места или общия етнически профил на района) и го отбележи в "note" — НИКОГА не пропускай самия блок.
4. Блок/ове "list" за останалите точки (махали, домакинства, прираст, гъстота, статус).
Числа като диапазон замести с ЕДНА приблизителна стойност.`;

/** Специфично оформление за категория „history“ (Исторически профил). */
const HISTORY_LAYOUT = `СПЕЦИАЛНИ ПРАВИЛА ЗА ТАЗИ КАТЕГОРИЯ — блоковете са точно в този ред:
1. ЕДИН блок "facts" с ДО 3 малки кутийки: "Първо споменаване" (век/година, до 2–3 думи), "Произход на името" (до 2–3 думи), "Предишно име" (име или "Няма"). Пропусни кутийка, за която няма данни; без "description", без дълги стойности.
2. ЗАДЪЛЖИТЕЛНО ЕДИН блок "bars" (заглавие "Население по преброявания (НСИ)", "unit": "души") с по един елемент на всяка година от текста, за която има конкретен брой — във възходящ ред по година. "label" е годината като низ, "value" е число. Ако в текста има поне 2 такива години, блокът е задължителен. Не измисляй години, липсващи в текста.
3. Блок "list" "Стопанско развитие и поминък" с "tone": amber при упадък/закрити предприятия, emerald при стабилно/растящо стопанство, sky при смесена картина.
4. Блок "list" "Ключови исторически събития" (ако има такива).
5. Блок "list" "Документирано наследство, личности и находки" — обявени паметници, археологически обекти, известни личности, статус на обезлюдяване (ако има данни); без повторение на читалища, събори и обичаи.
6. Блок "text" "Дългосрочна тенденция" с "tone": rose при траен спад, amber при стагнация, emerald при ръст — НЕ с variant "highlight".
7. По избор ЕДИН блок "text" с variant "highlight" за един интересен исторически факт (title = заглавието на факта).
Числа като диапазон замести с ЕДНА приблизителна стойност; годините не се променят.`;

const SCHEMA_DOC = `Върни САМО JSON обект със следната структура (без markdown огради):
{
  "title": string,                       // кратко заглавие на секцията на български
  "subtitle": string,                    // едно изречение пояснение
  "blocks": Block[],                     // 2 до 8 блока — толкова, колкото реално има теми/факти в текста; НЕ съкращавай съдържание само за да се вместиш в по-малко блокове
  "incidentCount": number | null         // само за категория "risks": брой регистрирани рискови събития, иначе null
}
ВАЖНО: структурирай ВСИЧКИ конкретни факти, числа и раздели от изследователския текст — не пропускай информация само защото "блоковете свършват". Ако темите в текста са повече от 5, използвай до 8 блока, вместо да съкращаваш или сливаш несвързани теми в един блок.
Block е един от:
{"kind":"facts","items":[{"label":string,"value":string,"description":string,"size":"sm"|"md"}]}  // 2-6 кратки факта; "description" е по избор; "size" е по избор ("sm" по подразбиране) — "md" прави кутийката двойно по-широка, за стойност с повече обяснителен текст
{"kind":"text","title":string,"body":string,"variant":"default"|"dark"|"highlight"|"alert","tone":"emerald"|"sky"|"blue"|"amber"|"violet"|"purple"|"rose"|"teal"}  // "tone" оцветява кутийката като в категория "basic" (само за категориите, чиито специални правила по-горе го изискват — напр. "basic", "services"). "alert" е оцветен с червеникав фон и удивителни иконки, за важна/критична информация (напр. медиен преглед в категория "security")
// "variant" е по избор и по подразбиране е "default".
// "dark" ползвай САМО за обобщаващия медиен преглед в категория "security".
// "highlight" ползвай САМО за един интересен исторически/фолклорен факт в категория "history"
// (в този случай "title" е заглавието на факта; НЕ го ползвай за дългосрочната тенденция).
{"kind":"list","title":string,"items":string[],"tone":"emerald"|"sky"|"blue"|"amber"|"violet"|"purple"|"rose"|"teal"}  // "tone" е по избор, само когато специалните правила по-горе за категорията го изискват
{"kind":"distances","title":string,"rows":[{"to":string,"distance":string,"driveTime":string,"hasTrain":boolean,"road":string,"info":string}]}   // "info" е по избор — 1–2 изречения защо обектът е известен/релевантен, САМО за интересни обекти (курорти, бани, язовири, забележителности, градове с особеност), НЕ за летища, гари и магистрали. САМО за категория "basic": таблица с отстояния; "hasTrain" е true само ако има влакова връзка/гара (без времена с влак), "road" — номерата на пътищата
{"kind":"scale","title":string,"items":[{"label":string,"level":"good"|"fair"|"poor","levelText":string,"percent":number,"note":string}]}   // САМО за категория "vik": двускален индикатор — "levelText" е дума/до 3 думи (напр. "Добро", "Твърда вода", "Сезонни спирания"), "percent" 0-100, "note" е пълно описателно изречение(я)
{"kind":"pie","title":string,"note":string,"data":[{"name":string,"value":number}]}   // value = процент, сборът ~100
{"kind":"bars","title":string,"unit":string,"note":string,"data":[{"label":string,"value":number}]}   // САМО за категория "history": колонна диаграма на населението по преброявания; "label" е годината (напр. "1946"), "value" е броят души (число), "unit" е "души"
{"kind":"schedule","title":string,"note":string,"rows":[{"route":string,"days":string,"runs":string,"last":string}]}
{"kind":"risks","title":string,"items":[{"label":string,"level":"low"|"medium"|"high","percent":number,"note":string,"incidentCount":number}]}
// "percent" е по избор, 0-100 — относителната тежест на риска за визуалната лента (низък ~10-25, среден ~40-60, висок ~70-90).
{"kind":"checklist","title":string,"items":[{"title":string,"points":string[]}]}
{"kind":"gauge","title":string,"value":number,"direction":"up"|"down"|"neutral","periodLabel":string,"note":string}   // value = процент 0-100 (абсолютна стойност на промяната); "periodLabel" е КРАТЪК — най-много 3 думи или период (напр. "2011–2021", "10 години"), показва се в кръга
{"kind":"cards","title":string,"items":[{"icon":string,"label":string,"body":string,"tone":"emerald"|"sky"|"blue"|"amber"|"violet"|"purple"|"rose"|"teal"}]}
Използвай "pie" само при реални процентни разпределения, "schedule" само за транспортни разписания,
"risks" само за рискови оценки. НЕ използвай "checklist" — за списъци с подтеми ползвай "list" (един елемент на подтема във формат "Подтема: изречение").
Използвай "gauge" САМО за демографски тренд (категория "ethnos") и за ценови тренд на имотите
(категория "industry"). Никъде другаде. "direction" е посоката на промяната, "value" е величината ѝ в проценти.
Използвай "cards" САМО за категоризирана обратна връзка с ясно разграничени тонове
(напр. категория "social": положителни сигнали → emerald, клубове → blue, онлайн общности → purple,
отрицателни сигнали → rose). Не превръщай обикновени списъци в "cards" без ясно тонално разделение.`;

/** Стъпка 2: структуриране на грундирания текст в нашия JSON формат (без tools). */
async function structureCategory(
  input: GenerateInput,
  id: PlaceIdentity,
  research: string,
): Promise<{ section: Omit<ReportSection, "id" | "theme">; incidentCount: number | null }> {
  const prompt = `Структурирай следния готов изследователски текст за „${id.name}, община ${
    id.municipality ?? "—"
  }, област ${id.province ?? "—"} (ЕКАТТЕ ${id.ekatte})“ (тема: ${moduleLabel(
    input.categoryId,
  )}) в JSON за визуална инфографика.

${SCHEMA_DOC}

${input.categoryId === "basic" ? BASIC_LAYOUT : input.categoryId === "vik" ? VIK_LAYOUT : input.categoryId === "transport" ? TRANSPORT_LAYOUT : input.categoryId === "ethnos" ? ETHNOS_LAYOUT : input.categoryId === "history" ? HISTORY_LAYOUT : ""}

Не добавяй факти, които ги няма в текста. Не включвай URL адреси в стойностите.
Не пропускай съществени факти, числа или раздели от текста — представи ги ВСИЧКИ в подходящи блокове, дори ако това означава да използваш повече блокове.
Ако някъде в текста е посочена друга община или област, различна от община ${
    id.municipality ?? "—"
  } / област ${id.province ?? "—"}, не я пренасяй в JSON-а.


ТЕКСТ:
"""
${research}
"""`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  };

  let raw = textOf(await callGemini(body, STRUCTURE_MODEL));
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    // Един повторен опит с изрична инструкция за чист JSON.
    raw = textOf(
      await callGemini(
        {
          ...body,
          contents: [
            {
              role: "user",
              parts: [{ text: `${prompt}\n\nВАЖНО: върни само валиден JSON, без обяснения.` }],
            },
          ],
        },
        STRUCTURE_MODEL,
      ),
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
  // Невалидните блокове се изхвърлят поотделно, вместо да счупят цялата категория.
  const { blocks, dropped } = parseBlocks(obj.blocks);
  if (dropped > 0) {
    console.warn(
      `[report] категория „${input.categoryId}“: изхвърлени ${dropped} невалидни блока.`,
    );
  }
  if (blocks.length === 0) {
    throw new Error(`Моделът не върна съдържание за категория „${input.categoryId}“.`);
  }

  return {
    section: {
      title: typeof obj.title === "string" && obj.title ? obj.title : moduleLabel(input.categoryId),
      subtitle: typeof obj.subtitle === "string" ? obj.subtitle : "",
      blocks,
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
  const id = await placeIdentity(input);
  const research = await researchCategory(input, id);
  const { section, incidentCount } = await structureCategory(input, id, research.text);

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
          Extract<ReportSection["blocks"][number], { kind: "risks" }> | undefined)
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
      title: `От ${currentLocationName}`,
      items: [
        { label: "Разстояние по път", value: parsed.distanceKm ?? "—" },
        { label: "Време с кола", value: parsed.driveTime ?? "—" },
        { label: "Маршрут", value: parsed.route ?? "—" },
      ],
    } as unknown as Json,
    sources: sourcesOf(res),
  };
}
