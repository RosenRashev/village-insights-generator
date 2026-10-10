/**
 * Известие за новозаредени доклади. Браузърът помни последния видян брой кредити;
 * при по-голям брой показваме „Заредени са ви N нови доклада“. Без запис в базата.
 */
export type CreditNotice =
  | { kind: "none" }
  | { kind: "welcome"; credits: number }
  | { kind: "added"; added: number; credits: number };

/** `seen` е последният видян брой (или `null`, ако за това устройство няма запис). */
export function creditNotice(seen: number | null, credits: number): CreditNotice {
  if (seen === null) return credits > 0 ? { kind: "welcome", credits } : { kind: "none" };
  if (credits > seen) return { kind: "added", added: credits - seen, credits };
  return { kind: "none" };
}

export function reportsWord(n: number): string {
  return n === 1 ? "1 доклад" : `${n} доклада`;
}

export const CREDITS_SEEN_PREFIX = "kadeda:credits-seen:";

export function readSeen(userId: string): number | null {
  try {
    const raw = window.localStorage.getItem(CREDITS_SEEN_PREFIX + userId);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeSeen(userId: string, credits: number): void {
  try {
    window.localStorage.setItem(CREDITS_SEEN_PREFIX + userId, String(credits));
  } catch {
    // Липсата на localStorage (частен режим) не бива да чупи нищо.
  }
}
