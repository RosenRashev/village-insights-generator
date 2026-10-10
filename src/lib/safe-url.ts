/** Само http(s) връзки (източниците идват от модела/клиента и не бива да са `data:`/`javascript:`). */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function safeSources<T extends { url: string }>(sources: T[] | null | undefined): T[] {
  return (sources ?? []).filter((s) => isSafeHttpUrl(s.url));
}
