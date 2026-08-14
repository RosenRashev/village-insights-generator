export type Settlement = {
  ekatte: number;
  isVillage: boolean;
  name: string;
  municipality: string;
  province: string;
  postalCode: string;
  population?: number;
};

type Row = [number, number, string, string, string, string, number?];

export const LARGE_CITY_POPULATION_THRESHOLD = 30000;

/** Липсващи данни за население НЕ се третират като голям град. */
export function isLargeCity(s: Settlement): boolean {
  return typeof s.population === "number" && s.population >= LARGE_CITY_POPULATION_THRESHOLD;
}

let cache: Settlement[] | null = null;
let pending: Promise<Settlement[]> | null = null;

export async function loadSettlements(): Promise<Settlement[]> {
  if (cache) return cache;
  if (pending) return pending;
  pending = import("@/data/settlements.json").then((mod) => {
    const rows = (mod.default ?? mod) as unknown as Row[];
    const parsed = rows.map(
      ([ekatte, village, name, municipality, province, postalCode, population]) => ({
        ekatte,
        isVillage: village === 1,
        name,
        municipality,
        province,
        postalCode,
        population,
      }),
    );
    cache = parsed;
    return parsed;
  });
  return pending;
}


/** Позволени са само кирилица, интервал, тире, апостроф и цифри (за пощенски код). */
export function sanitizeCyrillic(value: string): string {
  return value.replace(/[^\u0400-\u04FF0-9\s\-'’.]/g, "");
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\u0400-\u04FF0-9]/g, "");
}

export function prefix(s: Settlement): string {
  return s.isVillage ? "с." : "гр.";
}

/** Кратко изписване за интерфейса. */
export function displaySettlement(s: Settlement): string {
  return `${prefix(s)} ${s.name} — общ. ${s.municipality}, обл. ${s.province}`;
}

/** Пълна еднозначна идентификация за промпта. */
export function formatSettlement(s: Settlement): string {
  const meta = [`ЕКАТТЕ ${String(s.ekatte).padStart(5, "0")}`];
  if (s.postalCode) meta.push(`пощенски код ${s.postalCode}`);
  return `${prefix(s)} ${s.name}, община ${s.municipality}, област ${s.province} (${meta.join(", ")})`;
}

export function searchSettlements(
  all: Settlement[],
  query: string,
  limit = 50,
): Settlement[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const starts: Settlement[] = [];
  const contains: Settlement[] = [];

  for (const s of all) {
    if (s.postalCode && s.postalCode.startsWith(q)) {
      starts.push(s);
      continue;
    }
    const n = normalize(s.name);
    if (n.startsWith(q)) starts.push(s);
    else if (n.includes(q) || normalize(s.municipality).startsWith(q)) contains.push(s);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains].slice(0, limit);
}
