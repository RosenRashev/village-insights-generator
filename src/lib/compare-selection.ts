/** Запомня избраните за сравнение места, за да не се губят при излизане от страницата. */

const KEY = "kadeda:compare";
const MAX = 3;

export function parseSelection(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: number[] = [];
    for (const v of parsed) {
      if (typeof v === "number" && Number.isInteger(v) && v > 0 && !out.includes(v)) out.push(v);
    }
    return out.slice(0, MAX);
  } catch {
    return [];
  }
}

export function loadSelection(): number[] {
  try {
    return parseSelection(sessionStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function saveSelection(ids: number[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // Частен режим или блокирано съхранение — изборът просто няма да се запомни.
  }
}
