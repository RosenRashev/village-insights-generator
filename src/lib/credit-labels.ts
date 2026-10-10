/** Човешки етикети за историята на докладите. */
export function reasonLabel(reason: string): string {
  switch (reason) {
    case "admin":
      return "Заредени от администратор";
    case "request":
      return "Одобрена заявка";
    case "report":
      return "Нов доклад";
    case "refund":
      return "Върнат (докладът не се запази)";
    case "welcome":
      return "Безплатен доклад при одобрение";
    default:
      return reason;
  }
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** „преди 5 мин“, „преди 3 ч“, „вчера“, иначе дата. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "сега";
  if (min < 60) return `преди ${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 7) return `преди ${d} дни`;
  return new Date(iso).toLocaleDateString("bg-BG");
}
