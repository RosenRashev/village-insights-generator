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
