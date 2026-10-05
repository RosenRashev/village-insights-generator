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
  test("групите са по категории, а оценките от местата са в един ред", () => {
    const groups = buildComparison([
      { label: "А", sections: [vikGood] },
      { label: "Б", sections: [vikPoor] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("vik");
    expect(groups[0]?.rows).toHaveLength(1);
    expect(groups[0]?.rows[0]).toMatchObject({
      label: "Качество на питейната вода",
      cells: [
        { text: "Добро", level: "good" },
        { text: "Твърда", level: "poor" },
      ],
    });
  });

  test("липсваща информация е null", () => {
    const groups = buildComparison([
      { label: "А", sections: [vikGood] },
      { label: "Б", sections: [] },
    ]);
    expect(groups[0]?.rows[0]?.cells[1]).toBeNull();
  });

  test("нищо не се филтрира — и кутийки без „важно“ име влизат", () => {
    const groups = buildComparison([
      {
        label: "А",
        sections: [
          section("basic", [
            {
              kind: "facts",
              items: [
                { label: "Надм. височина", value: "~420 м" },
                { label: "Нещо друго", value: "5", description: "Пояснение" },
              ],
            },
          ]),
        ],
      },
    ]);
    expect(groups[0]?.rows.map((r) => r.label)).toEqual(["Надм. височина", "Нещо друго"]);
    expect(groups[0]?.rows[1]?.cells[0]).toEqual({ text: "5", note: "Пояснение" });
  });

  test("всички рискове са отделни редове с ниво", () => {
    const [g] = buildComparison([
      {
        label: "А",
        sections: [
          section("risks", [
            {
              kind: "risks",
              title: "Рискове",
              items: [
                { label: "Наводнения", level: "low", incidentCount: 0 },
                { label: "Пожари", level: "high", incidentCount: 3, note: "Сухо лято" },
              ],
            },
          ]),
        ],
      },
    ]);
    expect(g?.rows).toHaveLength(2);
    expect(g?.rows[1]?.cells[0]).toEqual({
      text: "висок · 3 случая",
      note: "Сухо лято",
      level: "poor",
    });
  });

  test("диаграма, списък и текст запазват цялата информация", () => {
    const [g] = buildComparison([
      {
        label: "А",
        sections: [
          section("history", [
            {
              kind: "pie",
              title: "Състав",
              data: [
                { name: "Българи", value: 70 },
                { name: "Роми", value: 30 },
              ],
            },
            { kind: "list", title: "Събития", items: ["едно", "две"] },
            { kind: "text", title: "Тенденция", body: "Дълъг текст" },
            {
              kind: "bars",
              title: "Население",
              unit: "души",
              data: [
                { label: "1946", value: 600 },
                { label: "2021", value: 130 },
              ],
            },
          ]),
        ],
      },
    ]);
    expect(g?.rows[0]?.cells[0]).toEqual({ lines: ["Българи — 70%", "Роми — 30%"] });
    expect(g?.rows[1]?.cells[0]).toEqual({ lines: ["едно", "две"] });
    expect(g?.rows[2]?.cells[0]).toEqual({ note: "Дълъг текст" });
    expect(g?.rows[3]?.cells[0]).toMatchObject({
      text: "600 → 130 души",
      note: "1946: 600 · 2021: 130",
      level: "poor",
    });
  });

  test("еднакви заглавия в една категория не се губят", () => {
    const [g] = buildComparison([
      {
        label: "А",
        sections: [
          section("x", [
            { kind: "list", title: "Забележки", items: ["a"] },
            { kind: "list", title: "Забележки", items: ["b"] },
          ]),
        ],
      },
    ]);
    expect(g?.rows).toHaveLength(2);
  });

  test("общите данни са първа група, а чек-листът за оглед се пропуска", () => {
    const groups = buildComparison([
      {
        label: "А",
        place: {
          ekatte: 1,
          isVillage: true,
          name: "А",
          municipality: "Община",
          province: "Област",
          postalCode: "1000",
          population: 1558,
        },
        sections: [vikGood, section("onsite-checklist", [{ kind: "list", items: ["x"] }])],
      },
    ]);
    expect(groups.map((g) => g.id)).toEqual(["general", "vik"]);
    expect(groups[0]?.rows.map((r) => r.label)).toEqual(["Община", "Област", "Население (НСИ)"]);
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
