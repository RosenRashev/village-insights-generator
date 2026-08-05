import {
  BASE_PROMPT,
  COMMON_RULES,
  DISTRICT_RULE,
  LEVEL_RULE,
  PROMPT_MODULES,
  PLACE_TYPES,
  SYNTHESIS_RULES,
  TEMPLATE_INTRO,
  type PlaceType,
} from "./prompt-modules";

export type PromptInput = {
  place: string;
  placeType: PlaceType;
  selected: string[];
};

export function buildPrompt({ place, placeType, selected }: PromptInput): string {
  const typeLabel = PLACE_TYPES.find((t) => t.value === placeType)?.label ?? "";
  const target = place.trim() || "[населено място]";

  const sections = PROMPT_MODULES.filter((m) => selected.includes(m.id))
    .map((m, i) => m.section.replace(/^\d+\./, `${i + 1}.`))
    .join("\n\n");

  const parts = [
    BASE_PROMPT,
    placeType === "district" ? DISTRICT_RULE : LEVEL_RULE,
    COMMON_RULES,
    TEMPLATE_INTRO,
    `ОБЕКТ НА ПРОУЧВАНЕТО:
Тип: ${typeLabel}
Наименование / пощенски код: ${target}`,
    sections ? `РАЗДЕЛИ ЗА ПОКРИВАНЕ:\n\n${sections}` : "",
    "ФОРМАТ НА ОТГОВОРА:\nЗа всеки раздел използвай заглавие и кратки булети. Всяко твърдение с източник и дата в скоби. Липсващите данни — с точния текст „Няма налична информация“.",
  ].filter(Boolean);

  return parts.join("\n\n");
}
