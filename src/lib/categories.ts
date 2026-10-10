/**
 * Категориите на доклада (идентификатор и заглавие) — без текстовете на промптовете.
 * Клиентският код ползва този малък модул, а `prompt-modules.ts` остава само на сървъра
 * (иначе ~100 KB промпт текст се изтеглят в браузъра). Тестът `categories.test.ts` пази
 * двата списъка синхронизирани.
 */
export const CATEGORIES: { id: string; label: string }[] = [
  { id: "basic", label: "ИНФРАСТРУКТУРА НА НАСЕЛЕНОТО МЯСТО" },
  { id: "vik", label: "ВОДОСНАБДЯВАНИE, КАНАЛИЗАЦИЯ И ВОДНИ РЕСУРСИ" },
  { id: "ethnos", label: "ДЕМОГРАФИЯ, ЕТНИЧЕСКИ СЪСТАВ И СТРУКТУРА НА НАСЕЛЕНИЕТО" },
  { id: "transport", label: "ТРАНСПОРТНА СВЪРЗАНОСТ, ПЪТНА МРЕЖА И ИНФРАСТРУКТУРА" },
  { id: "power", label: "ЕЛЕКТРОЗАХРАНВАНЕ И ОТОПЛЕНИЕ" },
  { id: "security", label: "СИГУРНОСТ, ПРЕСТЪПНОСТ И СЪСЕДСКА СРЕДА" },
  { id: "social", label: "СОЦИАЛЕН ЖИВОТ И ОНЛАЙН РЕПУТАЦИЯ" },
  { id: "health", label: "ЗДРАВЕ И СОЦИАЛНИ ГРИЖИ" },
  { id: "services", label: "ОБРАЗОВАНИЕ, ДЕЦА И ЕЖЕДНЕВНИ УСЛУГИ" },
  { id: "industry", label: "РАЗВИТИЕ И ИНВЕСТИЦИОНЕН ПОТЕНЦИАЛ" },
  { id: "connectivity", label: "ИНТЕРНЕТ СВЪРЗАНОСТ, МОБИЛНО ПОКРИТИЕ И СРЕДА ЗА РАБОТА ОТ ВКЪЩИ" },
  { id: "culture", label: "КУЛТУРА" },
  { id: "risks", label: "ПРИРОДНИ РИСКОВЕ И ЕКОЛОГИЯ" },
  { id: "environment", label: "КОМФОРТ НА СРЕДАТА" },
  { id: "history", label: "ИСТОРИЧЕСКИ ПРОФИЛ" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
