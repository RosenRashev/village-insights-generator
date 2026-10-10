/**
 * Превежда технически грешки (Supabase Auth, мрежа, валидация) в съобщения на български.
 * Неразпознатите технически текстове не се показват на потребителя.
 */
const RULES: [RegExp, string][] = [
  [/invalid login credentials/i, "Грешен имейл или парола."],
  [/email not confirmed/i, "Имейлът още не е потвърден. Проверете пощата си."],
  [
    /user already registered|already been registered/i,
    "С този имейл вече има регистрация. Опитайте да влезете.",
  ],
  [
    /password should be at least|weak password|at least \d+ characters/i,
    "Паролата е твърде кратка.",
  ],
  [/same password|different from the old/i, "Новата парола трябва да е различна от старата."],
  [
    /rate limit|too many requests|over_email_send_rate_limit|for security purposes/i,
    "Твърде много опити. Изчакайте малко и опитайте пак.",
  ],
  [
    /auth session missing|session.*(expired|not found)|jwt expired|invalid jwt|refresh token/i,
    "Сесията ви е изтекла. Влезте отново.",
  ],
  [
    /otp_expired|link.*(expired|invalid)|token has expired/i,
    "Връзката е изтекла или вече е използвана. Поискайте нова.",
  ],
  [
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i,
    "Няма връзка със сървъра. Проверете интернета и опитайте пак.",
  ],
  [/unable to validate email|invalid.*email/i, "Невалиден имейл адрес."],
  [/signups? not allowed|signup.*disabled/i, "Регистрациите са временно изключени."],
];

export const GENERIC_ERROR = "Нещо се обърка. Опитайте пак.";

export function toUserMessage(err: unknown, fallback: string = GENERIC_ERROR): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return fallback;
  for (const [re, msg] of RULES) if (re.test(raw)) return msg;
  // Вече български съобщения (от нашите сървърни функции) се показват както са.
  if (/[Ѐ-ӿ]/.test(raw)) return raw;
  return fallback;
}
