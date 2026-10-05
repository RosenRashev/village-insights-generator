import { describe, expect, test } from "bun:test";

import type { ReportSection } from "../src/data/mock-report";
import { buildComparison } from "../src/lib/compare";
import { parseFavorites, toggleFavorite } from "../src/lib/favorites";

const section = (id: string, blocks: ReportSection["blocks"]): ReportSection => ({
  id,
  title: id,
  theme: "slate",
  blocks,
});

const vikGood = section("vik", [
  {
    kind: "scale",
    items: [
      {
        label: "Качество на питейната вода",
        level: "good",
        levelText: "Добро",
        percent: 85,
        note: "",
      },
    ],
  },
]);
const vikPoor = section("vik", [
  {
    kind: "scale",
    items: [
      {
        label: "Качество на питейната вода",
        level: "poor",
        levelText: "Твърда",
        percent: 30,
        note: "",
      },
    ],
  },
]);

describe("buildComparison", () => {
  test("оценките от двете места попадат в един ред", () => {
    const rows = buildComparison([
      { label: "А", sections: [vikGood] },
      { label: "Б", sections: [vikPoor] },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      group: "Оценки",
      label: "Качество на питейната вода",
      cells: [
        { text: "Добро", level: "good" },
        { text: "Твърда", level: "poor" },
      ],
    });
  });

  test("липсваща информация е null, а ред без данни не се показва", () => {
    const rows = buildComparison([
      { label: "А", sections: [vikGood] },
      { label: "Б", sections: [] },
    ]);
    expect(rows[0]?.cells[1]).toBeNull();
  });

  test("рисковете се обобщават до най-сериозния", () => {
    const [worst] = buildComparison([
      {
        label: "А",
        sections: [
          section("risks", [
            {
              kind: "risks",
              title: "Рискове",
              items: [
                { label: "Наводнения", level: "low" },
                { label: "Пожари", level: "high" },
              ],
            },
          ]),
        ],
      },
    ]);
    expect(worst?.cells[0]).toEqual({ text: "Пожари (висок)", level: "poor" });
  });

  test("само избраните кутийки се сравняват", () => {
    const rows = buildComparison([
      {
        label: "А",
        sections: [
          section("basic", [
            {
              kind: "facts",
              items: [
                { label: "Надм. височина", value: "~420 м" },
                { label: "Нещо друго", value: "5" },
              ],
            },
          ]),
        ],
      },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Надморска височина"]);
  });

  test("групите са в ред: общи → оценки → показатели → рискове → тенденции", () => {
    const rows = buildComparison([
      {
        label: "А",
        sections: [
          section("x", [
            { kind: "gauge", title: "Демографски тренд", value: 20, direction: "down" },
            ...vikGood.blocks,
          ]),
        ],
      },
    ]);
    expect(rows.map((r) => r.group)).toEqual(["Оценки", "Тенденции"]);
  });
});

describe("любими", () => {
  test("невалидно съдържание дава празен списък", () => {
    expect(parseFavorites("не е json")).toEqual([]);
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
  });

  test("дублиращи се и повредени записи се изхвърлят", () => {
    const raw = JSON.stringify([
      { ekatte: 1, label: "А" },
      { ekatte: 1, label: "А2" },
      { ekatte: "2", label: "Б" },
      { ekatte: 3 },
    ]);
    expect(parseFavorites(raw)).toEqual([{ ekatte: 1, label: "А" }]);
  });

  test("toggle добавя и маха", () => {
    const added = toggleFavorite([], { ekatte: 1, label: "А" });
    expect(added).toHaveLength(1);
    expect(toggleFavorite(added, { ekatte: 1, label: "А" })).toEqual([]);
  });
});
