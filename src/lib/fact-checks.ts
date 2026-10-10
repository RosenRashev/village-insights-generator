import type { Json } from "@/integrations/supabase/types";

/**
 * Проверки за наличие на обекти (автогара, EasyPay, аптека…).
 *
 * Проблемът: търсенето е ограничено до 2 заявки на категория, а моделът отговаряше „има“/„няма“
 * и за обекти, които изобщо не е проверил. Затова всяка проверка завършва с един от три статуса,
 * а непроверените НЕ се показват в доклада. При второ генериране (само за малки места) се
 * проверяват точно пропуснатите.
 */

export type CheckStatus = "confirmed" | "denied" | "unverified";

export type FactCheck = {
  key: string;
  /** Как се казва точката в промпта и в бележките към модела. */
  label: string;
  /** Насока за търсенето. */
  hint: string;
};

export const FACT_CHECKS: Record<string, FactCheck[]> = {
  transport: [
    {
      key: "bus_station",
      label: "автогара (обособен автобусен терминал; обикновена спирка НЕ е автогара)",
      hint: "„автогара <място>“ в Google Maps, разписания на автобусни превозвачи",
    },
    {
      key: "train_stop",
      label: "жп гара или спирка в самото населено място",
      hint: "разписание на БДЖ, „жп гара <място>“",
    },
    {
      key: "intercity_bus",
      label: "редовна междуградска автобусна линия с разписание",
      hint: "разписания на автобусни превозвачи, общински сайт",
    },
    {
      key: "taxi",
      label: "редовно такси в населеното място",
      hint: "„такси <място>“",
    },
  ],
  services: [
    {
      key: "grocery",
      label: "хранителен магазин",
      hint: "Google Maps „магазин <място>“",
    },
    {
      key: "atm",
      label: "банкомат или банков клон",
      hint: "локатори на банките, Google Maps",
    },
    {
      key: "bill_payment",
      label: "пункт за плащане на сметки (EasyPay, ePay, Български пощи)",
      hint: "локатор на EasyPay „пунктове <място>“",
    },
    {
      key: "post_office",
      label: "пощенска станция на Български пощи",
      hint: "търсач на пощенски станции на Български пощи",
    },
    {
      key: "courier",
      label: "офис или автомат на куриер (Еконт, Спиди, Box Now)",
      hint: "локатори на куриерите",
    },
    {
      key: "kindergarten",
      label: "детска градина",
      hint: "общински сайт, регистър на МОН",
    },
    {
      key: "school",
      label: "училище (до кой клас)",
      hint: "регистър на институциите на МОН",
    },
    {
      key: "town_hall",
      label: "кметство или кметски наместник",
      hint: "общински сайт",
    },
  ],
  health: [
    {
      key: "gp",
      label: "общопрактикуващ лекар в населеното място",
      hint: "регистър на лекарите, НЗОК, Google Maps",
    },
    {
      key: "pharmacy",
      label: "аптека в населеното място",
      hint: "Google Maps „аптека <място>“",
    },
    {
      key: "dentist",
      label: "зъболекар в населеното място",
      hint: "Google Maps „зъболекар <място>“",
    },
  ],
};

export function checksFor(categoryId: string): FactCheck[] {
  return FACT_CHECKS[categoryId] ?? [];
}

const STATUS_WORDS: Record<string, CheckStatus> = {
  ПОТВЪРДЕНО: "confirmed",
  ОТХВЪРЛЕНО: "denied",
  НЕПРОВЕРЕНО: "unverified",
};

const CHECK_LINE = /^\s*[*_>-]*\s*ПРОВЕРКА\s+([^\s:]+)\s*:\s*([А-ЯA-Z]+)/i;

/** Инструкция към изследването: кои обекти да се проверят и как да се отчетат. */
export function checkListRule(categoryId: string): string {
  const checks = checksFor(categoryId);
  if (checks.length === 0) return "";
  const list = checks.map((c) => `- ${c.key}: ${c.label} (търси: ${c.hint})`).join("\n");
  return `ПРОВЕРКА НА НАЛИЧИЕТО НА ОБЕКТИ (задължително):
Днешната информация за тези обекти трябва да е потвърдена, а не предполагана. Проверявай ги с целеви търсения към конкретния източник (карти, локатори, разписания, регистри):
${list}
След основния текст, преди „ИЗТОЧНИЦИ:“, добави по един ред за ВСЯКА точка от списъка точно във формата:
ПРОВЕРКА <ключ>: ПОТВЪРДЕНО | ОТХВЪРЛЕНО | НЕПРОВЕРЕНО
- ПОТВЪРДЕНО: намери конкретен източник, че обектът съществува в това населено място (опиши го в текста с източника).
- ОТХВЪРЛЕНО: намери конкретен източник, който показва, че обекта няма (например карта или регистър за мястото без такъв обект). Липсата на резултат в търсенето НЕ е доказателство за липса.
- НЕПРОВЕРЕНО: не си търсил или нямаш източник. За такава точка НЕ пиши в основния текст нито че има, нито че няма обект — просто я пропусни.
Никога не пиши „няма“ за обект, който не е ОТХВЪРЛЕН с източник. Обикновена автобусна спирка не е автогара.`;
}

/** Статуси по ключ; липсващ или неразпознат ред = непроверено. */
export function parseCheckStatuses(text: string, categoryId: string): Record<string, CheckStatus> {
  const result: Record<string, CheckStatus> = {};
  for (const c of checksFor(categoryId)) result[c.key] = "unverified";
  for (const line of text.split("\n")) {
    const m = CHECK_LINE.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const status = STATUS_WORDS[m[2]!.toUpperCase()];
    if (status && key in result) result[key] = status;
  }
  return result;
}

/** Маха редовете „ПРОВЕРКА …“, за да не влизат в структурирането и в кеширания текст. */
export function stripCheckLines(text: string): string {
  return text
    .split("\n")
    .filter((l) => !CHECK_LINE.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pendingKeys(statuses: Record<string, CheckStatus>): string[] {
  return Object.entries(statuses)
    .filter(([, s]) => s === "unverified")
    .map(([k]) => k);
}

/** Обединява статусите: потвърдено/отхвърлено от по-ранно изследване не се връща към непроверено. */
export function mergeStatuses(
  previous: Record<string, CheckStatus>,
  next: Record<string, CheckStatus>,
): Record<string, CheckStatus> {
  const out: Record<string, CheckStatus> = { ...previous };
  for (const [k, s] of Object.entries(next)) {
    if (s !== "unverified" || !(k in out)) out[k] = s;
  }
  return out;
}

/** Инструкция към структурирането: непроверените точки не се показват. */
export function hideRule(categoryId: string, statuses: Record<string, CheckStatus>): string {
  const pending = new Set(pendingKeys(statuses));
  const hidden = checksFor(categoryId).filter((c) => pending.has(c.key));
  if (hidden.length === 0) return "";
  const list = hidden.map((c) => `- ${c.label}`).join("\n");
  return `НЕПРОВЕРЕНИ ТОЧКИ — НЕ ГИ ПОКАЗВАЙ:
За следните точки няма потвърдена информация. Не показвай за тях НИЩО — нито „Да“, нито „Няма“, нито „не е известно“, нито кутийка, ред или изречение (ако шаблонът изисква кутийка за такава точка, просто я пропусни):
${list}`;
}

/** Данните за допроверка, записвани заедно с категорията в `report_cache.data._checks`. */
export type StoredChecks = {
  statuses: Record<string, CheckStatus>;
  /** Изследователският текст (без редовете ПРОВЕРКА) — за повторно структуриране след допроверката. */
  research: string;
  followUpDone: boolean;
};

export function withChecks(data: Json, checks: StoredChecks | null): Json {
  if (!checks || typeof data !== "object" || data === null || Array.isArray(data)) return data;
  return { ...data, _checks: checks as unknown as Json };
}

/** Отделя `_checks` от данните; клиентът и докладите никога не ги получават. */
export function splitChecks(data: Json): { data: Json; checks: StoredChecks | null } {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { data, checks: null };
  }
  const { _checks, ...rest } = data as { [k: string]: Json | undefined } & { _checks?: Json };
  const raw = _checks as unknown as Partial<StoredChecks> | undefined;
  const valid =
    raw !== undefined &&
    raw !== null &&
    typeof raw === "object" &&
    typeof raw.research === "string" &&
    typeof raw.statuses === "object" &&
    raw.statuses !== null;
  return {
    data: rest as Json,
    checks: valid
      ? {
          statuses: raw.statuses as Record<string, CheckStatus>,
          research: raw.research as string,
          followUpDone: raw.followUpDone === true,
        }
      : null,
  };
}

/** Има ли смисъл от допроверка: непроверени точки, още не е правена и мястото не е голям град. */
export function needsFollowUp(checks: StoredChecks | null, isLargeCity: boolean): boolean {
  if (!checks || checks.followUpDone || isLargeCity) return false;
  return pendingKeys(checks.statuses).length > 0;
}
