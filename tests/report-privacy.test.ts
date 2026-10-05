import { describe, expect, test } from "bun:test";

import { missingSectionIds, sanitizeForPublic, stampGeneratedAt } from "../src/lib/report-privacy";

const report = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    place: { ekatte: 1 },
    current: { ekatte: 2, name: "Стара Загора" },
    purpose: "family",
    sections: [
      {
        id: "basic",
        blocks: [
          {
            kind: "facts",
            title: "От Стара Загора",
            items: [{ label: "Разстояние по път", value: "38 км" }],
          },
          { kind: "text", body: "Релеф" },
        ],
      },
    ],
    ...extra,
  });

describe("sanitizeForPublic", () => {
  test("маха настоящата локация и целта", () => {
    const out = JSON.parse(sanitizeForPublic(report()));
    expect(out.current).toBeUndefined();
    expect(out.purpose).toBeUndefined();
    expect(out.place).toEqual({ ekatte: 1 });
  });

  test("маха блока „От <локация>“, но не другите", () => {
    const out = JSON.parse(sanitizeForPublic(report()));
    expect(out.sections[0].blocks).toEqual([{ kind: "text", body: "Релеф" }]);
  });

  test("невалиден JSON се връща непроменен", () => {
    expect(sanitizeForPublic("не е json")).toBe("не е json");
  });
});

describe("stampGeneratedAt", () => {
  test("записва датата", () => {
    const out = JSON.parse(stampGeneratedAt(report(), "2026-10-05T10:00:00.000Z"));
    expect(out.generatedAt).toBe("2026-10-05T10:00:00.000Z");
  });
});

describe("missingSectionIds", () => {
  test("връща липсващите категории", () => {
    expect(missingSectionIds(report(), ["basic", "vik"])).toEqual(["vik"]);
  });

  test("невалидно съдържание — всички липсват", () => {
    expect(missingSectionIds("x", ["basic"])).toEqual(["basic"]);
  });
});

import { mergePersonal, splitPersonal } from "../src/lib/report-privacy";

describe("splitPersonal / mergePersonal", () => {
  test("публичната част е без лична информация, а личната се запазва отделно", () => {
    const { publicContent, personal } = splitPersonal(report());
    const pub = JSON.parse(publicContent);
    expect(pub.current).toBeUndefined();
    expect(pub.purpose).toBeUndefined();
    expect(pub.sections[0].blocks).toEqual([{ kind: "text", body: "Релеф" }]);
    expect(personal?.current).toEqual({ ekatte: 2, name: "Стара Загора" });
    expect(personal?.purpose).toBe("family");
    expect(personal?.blocks).toHaveLength(1);
  });

  test("обратното сливане възстановява пълния доклад за автора", () => {
    const original = JSON.parse(report());
    const { publicContent, personal } = splitPersonal(report());
    const merged = JSON.parse(mergePersonal(publicContent, personal));
    expect(merged.current).toEqual(original.current);
    expect(merged.purpose).toBe(original.purpose);
    expect(merged.sections[0].blocks).toEqual(original.sections[0].blocks);
  });

  test("доклад без лична информация няма лична част", () => {
    const plain = JSON.stringify({ place: { ekatte: 1 }, sections: [{ id: "basic", blocks: [] }] });
    expect(splitPersonal(plain).personal).toBeNull();
    expect(mergePersonal(plain, null)).toBe(plain);
  });

  test("невалиден JSON не се чупи", () => {
    expect(splitPersonal("x")).toEqual({ publicContent: "x", personal: null });
    expect(mergePersonal("x", { current: 1 })).toBe("x");
  });
});
