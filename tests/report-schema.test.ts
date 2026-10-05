import { describe, expect, test } from "bun:test";

import { parseBlocks } from "../src/lib/report-schema";

describe("parseBlocks", () => {
  test("приема валидни блокове", () => {
    const { blocks, dropped } = parseBlocks([
      { kind: "facts", items: [{ label: "Надм. височина", value: "~420 м" }] },
      { kind: "text", body: "Текст" },
    ]);
    expect(dropped).toBe(0);
    expect(blocks).toHaveLength(2);
  });

  test("число вместо низ се превръща в низ", () => {
    const { blocks } = parseBlocks([{ kind: "facts", items: [{ label: "Изходи", value: 3 }] }]);
    expect(blocks[0]).toEqual({ kind: "facts", items: [{ label: "Изходи", value: "3" }] });
  });

  test("null на по-избор поле се маха, а не чупи блока", () => {
    const { blocks } = parseBlocks([
      { kind: "facts", items: [{ label: "A", value: "1", description: null }] },
    ]);
    expect(blocks[0]).toEqual({ kind: "facts", items: [{ label: "A", value: "1" }] });
  });

  test("непознат tone/variant не чупи блока", () => {
    const { blocks, dropped } = parseBlocks([
      { kind: "text", body: "Текст", tone: "pink", variant: "huge" },
    ]);
    expect(dropped).toBe(0);
    expect(blocks[0]).toEqual({ kind: "text", body: "Текст" });
  });

  test("непознато ниво в scale/risks получава разумна стойност", () => {
    const { blocks } = parseBlocks([
      { kind: "scale", items: [{ label: "Вода", level: "great", levelText: "Добро", percent: 150, note: "" }] },
      { kind: "risks", items: [{ label: "Пожар", level: "extreme" }] },
    ]);
    expect(blocks[0]).toMatchObject({ items: [{ level: "fair", percent: 100 }] });
    expect(blocks[1]).toMatchObject({ items: [{ level: "medium" }] });
  });

  test("липсващо заглавие не губи данните", () => {
    const { blocks } = parseBlocks([{ kind: "risks", items: [{ label: "Пожар", level: "low" }] }]);
    expect(blocks[0]).toMatchObject({ title: "Оценка на рисковете" });
  });

  test("процентът като низ се чете като число", () => {
    const { blocks } = parseBlocks([
      { kind: "pie", title: "Състав", data: [{ name: "Българи", value: "85,5" }] },
    ]);
    expect(blocks[0]).toMatchObject({ data: [{ name: "Българи", value: 85.5 }] });
  });

  test("невалидни елементи се изхвърлят, валидните остават", () => {
    const { blocks } = parseBlocks([
      { kind: "list", items: ["a", { x: 1 }, "b"] },
    ]);
    expect(blocks[0]).toEqual({ kind: "list", items: ["a", "b"] });
  });

  test("празни и непознати блокове се изхвърлят", () => {
    const { blocks, dropped } = parseBlocks([
      { kind: "facts", items: [] },
      { kind: "text", body: "  " },
      { kind: "magic", items: [1] },
      "не-обект",
      null,
    ]);
    expect(blocks).toHaveLength(0);
    expect(dropped).toBe(5);
  });

  test("не-масив връща празен резултат", () => {
    expect(parseBlocks({ kind: "text" })).toEqual({ blocks: [], dropped: 0 });
  });

  test("колонна диаграма с редове в низове", () => {
    const { blocks } = parseBlocks([
      { kind: "bars", title: "Население", unit: "души", data: [{ label: 1946, value: "620" }, { label: "2021", value: 138 }] },
    ]);
    expect(blocks[0]).toMatchObject({
      kind: "bars",
      data: [
        { label: "1946", value: 620 },
        { label: "2021", value: 138 },
      ],
    });
  });
});
