import { describe, expect, test } from "bun:test";

import { promptVersionFor } from "../src/lib/report-generator.server";

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
