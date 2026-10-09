import { describe, expect, test } from "bun:test";

import { PROMPT_MODULES } from "../src/lib/prompt-modules";
import {
  promptVersionFor,
  searchBudgetFor,
  searchBudgetRule,
} from "../src/lib/report-generator.server";

describe("promptVersionFor", () => {
  test("е стабилна за една и съща категория и място", () => {
    expect(promptVersionFor("vik", "village")).toBe(promptVersionFor("vik", "village"));
  });

  test("различава категориите", () => {
    expect(promptVersionFor("vik", "village")).not.toBe(promptVersionFor("power", "village"));
  });

  test("отчита оформлението, зависещо от типа място (транспорт)", () => {
    expect(promptVersionFor("transport", "village")).not.toBe(
      promptVersionFor("transport", "town"),
    );
  });

  test("има формат <версия на шаблона>-<8 hex>", () => {
    expect(promptVersionFor("basic", "town")).toMatch(/^\d+-[0-9a-f]{8}$/);
  });
});

describe("бюджет за търсене", () => {
  test("всяка категория има най-много 3 заявки, а общо около 33", () => {
    const budgets = PROMPT_MODULES.map((m) => searchBudgetFor(m.id));
    expect(Math.max(...budgets)).toBeLessThanOrEqual(3);
    expect(budgets.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(36);
  });

  test("правилото в промпта съдържа точния брой и забрана за повторно търсене", () => {
    const rule = searchBudgetRule("history");
    expect(rule).toContain("НАЙ-МНОГО 3 заявки");
    expect(rule).toContain("Не повтаряй търсене");
    expect(searchBudgetRule("basic")).toContain("НАЙ-МНОГО 2 заявки");
  });

  test("промяната на шаблона обезсилва кеша (версията е различна от първата)", () => {
    expect(promptVersionFor("basic", "village")).toMatch(/^3-/);
  });
});
