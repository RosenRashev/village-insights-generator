/**
 * Безопасен път за връщане след вход (`?redirect=`). Допуска се само вътрешен път:
 * започва с един „/“ (не „//“ и не „/\“), без протокол и без контролни знаци.
 */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > 500) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  // Не връщаме към самата страница за вход (безкраен цикъл).
  if (/^\/vhod(\/|\?|#|$)/.test(value)) return fallback;
  return value;
}
