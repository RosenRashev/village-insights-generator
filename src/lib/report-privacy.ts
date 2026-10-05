/**
 * Публичните доклади са видими за всички и не трябва да съдържат лична информация
 * на автора им — настоящата му локация и избраната цел на търсенето.
 */

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parse(content: string): AnyRecord | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Блок „От <настояща локация>“ с разстояние/време — генерира се само при зададена локация. */
function isCurrentLocationBlock(block: unknown): boolean {
  if (!isRecord(block) || block["kind"] !== "facts") return false;
  const title = typeof block["title"] === "string" ? block["title"] : "";
  const items = Array.isArray(block["items"]) ? block["items"] : [];
  return (
    title.startsWith("От ") &&
    items.some((it) => isRecord(it) && it["label"] === "Разстояние по път")
  );
}

/** Премахва личната информация от сериализиран доклад. Невалидно съдържание се връща непроменено. */
export function sanitizeForPublic(content: string): string {
  const payload = parse(content);
  if (!payload) return content;

  delete payload["current"];
  delete payload["purpose"];

  if (Array.isArray(payload["sections"])) {
    payload["sections"] = payload["sections"].map((section) => {
      if (!isRecord(section) || !Array.isArray(section["blocks"])) return section;
      return { ...section, blocks: section["blocks"].filter((b) => !isCurrentLocationBlock(b)) };
    });
  }
  return JSON.stringify(payload);
}

/** Записва датата на генериране в доклада (сървърът е източникът на истината). */
export function stampGeneratedAt(content: string, iso: string): string {
  const payload = parse(content);
  if (!payload) return content;
  payload["generatedAt"] = iso;
  return JSON.stringify(payload);
}

/** Липсващи категории в доклада (за да не се запазват/публикуват непълни доклади). */
export function missingSectionIds(content: string, requiredIds: string[]): string[] {
  const payload = parse(content);
  const sections = payload && Array.isArray(payload["sections"]) ? payload["sections"] : [];
  const present = new Set(
    sections.filter(isRecord).map((s) => (typeof s["id"] === "string" ? s["id"] : "")),
  );
  return requiredIds.filter((id) => !present.has(id));
}

/**
 * Личната информация на автора на доклада: настояща локация, цел на търсенето и блокът
 * „От <локация>“. Пази се отделно от доклада, за да не я виждат другите потребители.
 */
export type Personal = {
  current?: unknown;
  purpose?: unknown;
  blocks?: { sectionId: string; block: unknown }[];
};

/** Разделя пълния доклад на „чист“ (за всички) и лична част (само за автора). */
export function splitPersonal(content: string): {
  publicContent: string;
  personal: Personal | null;
} {
  const payload = parse(content);
  if (!payload) return { publicContent: content, personal: null };

  const personal: Personal = {};
  if (payload["current"] != null) personal.current = payload["current"];
  if (payload["purpose"] != null) personal.purpose = payload["purpose"];
  delete payload["current"];
  delete payload["purpose"];

  const moved: NonNullable<Personal["blocks"]> = [];
  if (Array.isArray(payload["sections"])) {
    payload["sections"] = payload["sections"].map((section) => {
      if (!isRecord(section) || !Array.isArray(section["blocks"])) return section;
      const id = typeof section["id"] === "string" ? section["id"] : "";
      const kept: unknown[] = [];
      for (const b of section["blocks"]) {
        if (isCurrentLocationBlock(b)) moved.push({ sectionId: id, block: b });
        else kept.push(b);
      }
      return { ...section, blocks: kept };
    });
  }
  if (moved.length > 0) personal.blocks = moved;

  const hasPersonal = Object.keys(personal).length > 0;
  return { publicContent: JSON.stringify(payload), personal: hasPersonal ? personal : null };
}

/** Връща личната част в доклада (за автора). Липсваща лична част — докладът се връща непроменен. */
export function mergePersonal(content: string, personal: Personal | null | undefined): string {
  if (!personal) return content;
  const payload = parse(content);
  if (!payload) return content;

  if (personal.current != null) payload["current"] = personal.current;
  if (personal.purpose != null) payload["purpose"] = personal.purpose;

  if (personal.blocks && Array.isArray(payload["sections"])) {
    payload["sections"] = payload["sections"].map((section) => {
      if (!isRecord(section) || !Array.isArray(section["blocks"])) return section;
      const mine = personal
        .blocks!.filter((b) => b.sectionId === section["id"])
        .map((b) => b.block);
      // Блокът „От <локация>“ винаги е най-отгоре в секцията.
      return mine.length > 0 ? { ...section, blocks: [...mine, ...section["blocks"]] } : section;
    });
  }
  return JSON.stringify(payload);
}
