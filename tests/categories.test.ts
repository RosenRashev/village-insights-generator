import { describe, expect, test } from "bun:test";

import { CATEGORIES, categoryLabel } from "../src/lib/categories";
import { PROMPT_MODULES } from "../src/lib/prompt-modules";
import { PURPOSE_OPTIONS } from "../src/lib/purposes";

describe("CATEGORIES (клиентски списък)", () => {
  test("съвпада по ред, идентификатор и заглавие с модулите на промптовете", () => {
    expect(CATEGORIES).toEqual(PROMPT_MODULES.map((m) => ({ id: m.id, label: m.label })));
  });

  test("categoryLabel връща идентификатора за непозната категория", () => {
    expect(categoryLabel("basic")).toContain("ИНФРАСТРУКТУРА");
    expect(categoryLabel("nope")).toBe("nope");
  });
});

describe("PURPOSE_OPTIONS", () => {
  test("има пет цели с етикети", () => {
    expect(PURPOSE_OPTIONS.map((p) => p.id)).toEqual([
      "family",
      "weekend",
      "retirees",
      "remote",
      "investor",
    ]);
  });
});
