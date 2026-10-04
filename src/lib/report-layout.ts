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
  /разстоян|отстоян|летищ|гар[аи]|жп|железопът|път|артери|магистрал|време|автомоб|км|мин|курорт|бани|язовир|възел|възли|транспорт|обходен|посока|маршрут/i;

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
 * Оформление на категория „Демография“:
 *  - демографски тренд (gauge) най-отгоре;
 *  - кутийки само за ключови проценти (постоянно живущи, млади, възрастни, образовани);
 *  - „гъстота на населението“ и „статус на населеното място“ никога не са отделна кутийка —
 *    преместват се като изречение в текстов/списъчен блок;
 *  - етническата кръгова диаграма следва веднага след кутийките.
 */
export function layoutEthnosBlocks(blocks: ReportBlock[]): ReportBlock[] {
  const gauges: ReportBlock[] = [];
  const factBoxes: FactItem[] = [];
  const pies: ReportBlock[] = [];
  const rest: ReportBlock[] = [];
  const extraLines: string[] = [];
  let listIdx = -1;

  const outRest: ReportBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "gauge") {
      gauges.push(b);
    } else if (b.kind === "pie") {
      pies.push(b);
    } else if (b.kind === "facts") {
      for (const it of b.items) {
        if (/гъстота|статус/i.test(it.label)) {
          extraLines.push(`${it.label}: ${approximateRanges(it.value)}${it.description ? ` — ${it.description}` : ""}`);
        } else {
          factBoxes.push(it);
        }
      }
    } else {
      if (b.kind === "list" && listIdx < 0) listIdx = outRest.length;
      outRest.push(b);
    }
  }

  if (extraLines.length > 0) {
    if (listIdx >= 0) {
      const l = outRest[listIdx] as Extract<ReportBlock, { kind: "list" }>;
      outRest[listIdx] = { ...l, items: [...extraLines, ...l.items] };
    } else {
      outRest.unshift({ kind: "list", title: "Допълнителни данни", items: extraLines });
    }
  }

  // Защитна мрежа: диаграмата на етническия състав трябва да присъства ВИНАГИ.
  // Ако моделът въпреки инструкциите не я е върнал, показваме видим placeholder
  // вместо да изчезне напълно от доклада.
  const pieBlocks =
    pies.length > 0
      ? pies
      : [
          {
            kind: "pie" as const,
            title: "Етнически състав",
            note: "Няма налични данни за етническия състав при генерирането на този доклад. Опитайте да прегенерирате доклада.",
            data: [{ name: "Няма данни", value: 100 }],
          },
        ];

  const out: ReportBlock[] = [...gauges];
  if (factBoxes.length > 0) out.push({ kind: "facts", items: factBoxes });
  out.push(...pieBlocks, ...outRest);
  return out;
}

/**
 * Оформление на категория „Инфраструктура“:
 *  - без пощенски код в кутийките (той е в заглавието на доклада);
 *  - кутийки само за числа / до 2 думи, с приблизителни стойности вместо диапазони;
 *  - всичко останало (описания, дълги стойности) се слива в свободен текст под кутийките.
 */
type FactItem = Extract<ReportBlock, { kind: "facts" }>["items"][number];

/** Кои кутийки отиват в най-горния ред: надм. височина, областен град, летище (в този ред). */
function topSlot(label: string): 0 | 1 | 2 | null {
  if (/летищ/i.test(label)) return 2;
  if (/височин/i.test(label)) return 0;
  if (/магистрал|\bАМ\b|тракия|хемус|жп|гара|време/i.test(label)) return null;
  if (/областн/i.test(label) || /^(разстояние\s+)?до\s+\S/i.test(label)) return 1;
  return null;
}

/**
 * Оформление на категория „Инфраструктура“:
 *  - без пощенски код в кутийките (той е в заглавието на доклада);
 *  - горен ред кутийки: надм. височина, най-близък областен град, най-близко летище; под него — останалите;
 *  - кутийки само за числа / до 2 думи, с приблизителни стойности вместо диапазони;
 *  - разстояния/транспорт се отделят от останалата информация; подкатегориите са оцветени.
 */
export function layoutBasicBlocks(blocks: ReportBlock[]): ReportBlock[] {
  const out: (ReportBlock | null)[] = [];
  const extraLines: string[] = [];
  const mainBoxes: FactItem[] = [];
  const titled: ReportBlock[] = [];
  let boxAt = -1;

  const splitItems = (items: FactItem[], intoBoxes: FactItem[]) => {
    for (const it of items) {
      if (/пощенск/i.test(it.label)) continue;
      const value = approximateRanges(it.value);
      if (isBoxValue(value)) {
        intoBoxes.push({
          label: it.label,
          value,
          ...(it.sources ? { sources: it.sources } : {}),
        });
      } else {
        extraLines.push(`${it.label}: ${value}${it.description ? ` — ${it.description}` : ""}`);
      }
    }
  };

  for (const b of blocks) {
    if (b.kind === "facts") {
      if (b.title) {
        const boxes: FactItem[] = [];
        splitItems(b.items, boxes);
        if (boxes.length > 0) titled.push({ kind: "facts", title: b.title, items: boxes });
      } else {
        if (boxAt < 0) {
          boxAt = out.length;
          out.push(null);
        }
        splitItems(b.items, mainBoxes);
      }
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

  // Подреждане на кутийките: горен ред (макс. 3) + останалите под него.
  const topSlots: (FactItem | undefined)[] = [undefined, undefined, undefined];
  const rest: FactItem[] = [];
  for (const it of mainBoxes) {
    const slot = topSlot(it.label);
    if (slot !== null && !topSlots[slot]) topSlots[slot] = it;
    else rest.push(it);
  }
  const top = topSlots.filter((x): x is FactItem => Boolean(x));
  const boxBlocks: ReportBlock[] = [];
  if (top.length > 0) {
    boxBlocks.push({ kind: "facts", featured: true, items: top });
  }
  if (rest.length > 0) boxBlocks.push({ kind: "facts", items: rest });
  boxBlocks.push(...titled);
  if (boxAt >= 0) out.splice(boxAt, 1, ...boxBlocks);
  else out.unshift(...boxBlocks);

  const result = out.filter((b): b is ReportBlock => b !== null);

  // Остатъчната информация се разделя: разстояния/транспорт отделно от останалото.
  const transport = extraLines.filter(
    (l) => TRANSPORT_RE.test(l.split(":")[0] ?? l) || TRAVEL_RE.test(l),
  );
  const place = extraLines.filter((l) => !transport.includes(l));
  if (place.length > 0) {
    result.push({ kind: "text", title: "Релеф и местоположение", body: place.join("\n"), tone: "emerald" });
  }
  if (transport.length > 0) {
    result.push({ kind: "text", title: "Транспорт и разстояния", body: transport.join("\n"), tone: "sky" });
  }
  return result;
}
