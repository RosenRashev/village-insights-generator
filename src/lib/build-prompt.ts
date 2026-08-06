import {
  BASE_PROMPT,
  COMMON_RULES,
  DISTRICT_RULE,
  ENVIRONMENT_RULES,
  LEVEL_RULE,
  PROMPT_MODULES,
  PLACE_TYPES,
  SYNTHESIS_RULES,
  TEMPLATE_INTRO,
  currentLocationModule,
  type PlaceType,
} from "./prompt-modules";

export type PromptInput = {
  place: string;
  placeType: PlaceType;
  selected: string[];
  currentLocation?: string;
};

export function buildPrompt({ place, placeType, selected, currentLocation }: PromptInput): string {
  const typeLabel = PLACE_TYPES.find((t) => t.value === placeType)?.label ?? "";
  const target = place.trim() || "[населено място]";
  const current = (currentLocation ?? "").trim();

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
    current ? currentLocationModule(target, current) : "",
    sections ? `РАЗДЕЛИ ЗА ПОКРИВАНЕ:\n\n${sections}` : "",
    ENVIRONMENT_RULES,
    SYNTHESIS_RULES,
  ].filter(Boolean);



  return parts.join("\n\n");
}
