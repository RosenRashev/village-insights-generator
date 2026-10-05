import { describe, expect, test } from "bun:test";

import type { ReportSection } from "../src/data/mock-report";
import { parseSummary } from "../src/lib/report-schema";
import { summaryChips } from "../src/lib/section-summary";

const section = (blocks: ReportSection["blocks"]): ReportSection => ({
  id: "x",
  title: "X",
  theme: "slate",
  blocks,
});

describe("summaryChips", () => {
  test("първо оценките от скалите, с цвят", () => {
    const chips = summaryChips(
      section([
        { kind: "facts", items: [{ label: "Дълбочина", value: "~20 м" }] },
        {
          kind: "scale",
          items: [
            { label: "Вода", level: "fair", levelText: "Твърда вода", percent: 50, note: "" },
            {
              label: "Стабилност",
              level: "poor",
              levelText: "Сезонни спирания",
              percent: 30,
              note: "",
            },
          ],
        },
      ]),
    );
    expect(chips).toEqual([
      { text: "Твърда вода", level: "fair" },
      { text: "Сезонни спирания", level: "poor" },
      { text: "Дълбочина: ~20 м" },
    ]);
  });

  test("не повече от 3 и без „няма данни“", () => {
    const chips = summaryChips(
      section([
        {
          kind: "facts",
          items: [
            { label: "А", value: "Няма налични публични данни" },
            { label: "Б", value: "1" },
            { label: "В", value: "2" },
            { label: "Г", value: "3" },
            { label: "Д", value: "4" },
          ],
        },
      ]),
    );
    expect(chips.map((c) => c.text)).toEqual(["Б: 1", "В: 2", "Г: 3"]);
  });

  test("тенденция и най-сериозен риск", () => {
    const chips = summaryChips(
      section([
        { kind: "gauge", title: "Демографски тренд", value: 23, direction: "down" },
        {
          kind: "risks",
          title: "Рискове",
          items: [
            { label: "Наводнения", level: "low" },
            { label: "Пожари", level: "high" },
          ],
        },
      ]),
    );
    expect(chips).toEqual([
      { text: "Демографски тренд: −23%", level: "poor" },
      { text: "Пожари: висок", level: "poor" },
    ]);
  });

  test("дълъг етикет се скъсява", () => {
    const [chip] = summaryChips(
      section([
        {
          kind: "scale",
          items: [{ label: "а", level: "good", levelText: "а".repeat(80), percent: 90, note: "" }],
        },
      ]),
    );
    expect(chip?.text.length).toBeLessThanOrEqual(38);
    expect(chip?.text.endsWith("…")).toBe(true);
  });

  test("празна категория няма етикети", () => {
    expect(summaryChips(section([{ kind: "text", body: "само текст" }]))).toEqual([]);
  });
});

describe("parseSummary", () => {
  test("чисти интервалите и приема само низ", () => {
    expect(parseSummary("  Водата   е \n твърда. ")).toBe("Водата е твърда.");
    expect(parseSummary(5)).toBeUndefined();
    expect(parseSummary("   ")).toBeUndefined();
  });

  test("дълъг текст се реже по дума и завършва с …", () => {
    const out = parseSummary(`${"дума ".repeat(80)}`)!;
    expect(out.length).toBeLessThanOrEqual(201);
    expect(out.endsWith("…")).toBe(true);
  });
});
