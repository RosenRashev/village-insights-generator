import { describe, expect, test } from "bun:test";

import type { ReportBlock } from "../src/data/mock-report";
import {
  approximateRanges,
  checklistsToLists,
  isBoxValue,
  layoutHistoryBlocks,
  mergeUndeclaredIntoOthers,
  sortBlocksBySize,
} from "../src/lib/report-layout";

describe("approximateRanges", () => {
  test("диапазонът става една приблизителна стойност", () => {
    expect(approximateRanges("100–120 км")).toBe("~110 км");
    expect(approximateRanges("35–40 мин")).toBe("~38 мин");
  });

  test("годините не се пипат", () => {
    expect(approximateRanges("2021–2024")).toBe("2021–2024");
  });

  test("текст без диапазон остава непроменен", () => {
    expect(approximateRanges("около 40 км")).toBe("около 40 км");
  });
});

describe("isBoxValue", () => {
  test("числа и до 2 думи са за кутийка", () => {
    expect(isBoxValue("~38 км")).toBe(true);
    expect(isBoxValue("Твърда вода")).toBe(true);
  });

  test("дълъг текст не е за кутийка", () => {
    expect(isBoxValue("Има редовен автобус до областния град всеки ден")).toBe(false);
  });
});

describe("sortBlocksBySize", () => {
  test("малки → средни → големи, стабилно", () => {
    const small: ReportBlock = { kind: "facts", items: [{ label: "a", value: "1" }] };
    const medium: ReportBlock = { kind: "list", items: ["x"] };
    const large: ReportBlock = { kind: "checklist", items: [{ title: "t", points: ["p"] }] };
    expect(sortBlocksBySize([large, medium, small])).toEqual([small, medium, large]);
  });
});

describe("layoutHistoryBlocks", () => {
  const bars = (n: number): ReportBlock => ({
    kind: "bars",
    title: "Население",
    unit: "души",
    data: Array.from({ length: n }, (_, i) => ({ label: String(1946 + i), value: 100 + i })),
  });

  test("диаграма с 2+ точки остава", () => {
    expect(layoutHistoryBlocks([bars(2)])[0]?.kind).toBe("bars");
  });

  test("диаграма с 1 точка става списък", () => {
    const [block] = layoutHistoryBlocks([bars(1)]);
    expect(block).toEqual({ kind: "list", title: "Население", items: ["1946 г. — 100 души."] });
  });

  test("диаграма без точки се скрива", () => {
    expect(layoutHistoryBlocks([bars(0)])).toEqual([]);
  });
});

describe("checklistsToLists", () => {
  test("номерираните групи стават един списък „Заглавие: точки“", () => {
    const [block] = checklistsToLists([
      {
        kind: "checklist",
        items: [
          { title: "Пазар", points: ["Има.", "Работи в петък."] },
          { title: "Празно", points: [] },
        ],
      },
    ]);
    expect(block).toEqual({ kind: "list", items: ["Пазар: Има. Работи в петък.", "Празно"] });
  });

  test("другите блокове не се пипат", () => {
    const text: ReportBlock = { kind: "text", body: "x" };
    expect(checklistsToLists([text])).toEqual([text]);
  });
});

describe("mergeUndeclaredIntoOthers", () => {
  test("„Недекларирали“ се добавя към „Други“", () => {
    expect(
      mergeUndeclaredIntoOthers([
        { name: "Българи", value: 65 },
        { name: "Роми", value: 28 },
        { name: "Други", value: 5 },
        { name: "Недекларирали", value: 2 },
      ]),
    ).toEqual([
      { name: "Българи", value: 65 },
      { name: "Роми", value: 28 },
      { name: "Други", value: 7 },
    ]);
  });

  test("без „Други“ се създава такава група", () => {
    expect(
      mergeUndeclaredIntoOthers([
        { name: "Българи", value: 90 },
        { name: "Не са отговорили", value: 10 },
      ]),
    ).toEqual([
      { name: "Българи", value: 90 },
      { name: "Други", value: 10 },
    ]);
  });

  test("нулева стойност не създава група", () => {
    expect(
      mergeUndeclaredIntoOthers([
        { name: "Българи", value: 100 },
        { name: "Недекларирали", value: 0 },
      ]),
    ).toEqual([{ name: "Българи", value: 100 }]);
  });
});
