import { describe, expect, test } from "bun:test";

import type { ReportSection } from "../src/data/mock-report";
import { buildPurposeComparison } from "../src/lib/compare";
import {
  collectSignals,
  computeFit,
  parseSignals,
  withPurposeSection,
  type Signal,
} from "../src/lib/purpose-fit";

const sig = (topic: Signal["topic"], score: number, confidence = 1): Signal => ({
  topic,
  score,
  confidence,
});
const section = (id: string, signals: Signal[]): ReportSection => ({
  id,
  title: id,
  theme: "slate",
  blocks: [],
  signals,
});

describe("parseSignals", () => {
  test("изхвърля непознати теми и невалидни числа, ограничава 1–10", () => {
    const out = parseSignals([
      { topic: "healthcare", score: 15, confidence: 2 },
      { topic: "nonsense", score: 5 },
      { topic: "internet", score: "abc" },
      { topic: "power", score: "7", note: "  ok " },
    ]);
    expect(out.map((s) => s.topic)).toEqual(["healthcare", "power"]);
    expect(out[0]).toMatchObject({ score: 10, confidence: 1 });
    expect(out[1]).toMatchObject({ score: 7, note: "ok" });
  });
});

describe("computeFit", () => {
  const signals = [
    sig("healthcare", 2),
    sig("pharmacy", 3),
    sig("quiet", 9),
    sig("safety", 9),
    sig("price_trend", 9),
    sig("demand", 8),
    sig("development", 8),
  ];

  test("същият доклад дава различна оценка за различна цел", () => {
    const retirees = computeFit(signals, "retirees");
    const investor = computeFit(signals, "investor");
    expect(investor.score!).toBeGreaterThan(retirees.score!);
    expect(retirees.cons.map((s) => s.topic)).toContain("healthcare");
    expect(investor.pros.map((s) => s.topic)).toContain("price_trend");
  });

  test("липсата на данни не е минус: малко данни → недостатъчно, не ниска оценка", () => {
    const fit = computeFit([], "retirees");
    expect(fit.score).toBeNull();
    expect(fit.unknown.length).toBeGreaterThan(0);
  });

  test("оскъдни данни се дърпат към неутралното", () => {
    const sparse = computeFit(
      [
        sig("healthcare", 10, 0.3),
        sig("quiet", 10, 0.3),
        sig("safety", 10, 0.3),
        sig("transport_public", 10, 0.3),
      ],
      "retirees",
    );
    expect(sparse.score!).toBeLessThan(9);
    expect(sparse.confidence).not.toBe("high");
  });
});

describe("секция и сравнение", () => {
  const sections = [
    section("a", [sig("internet", 9), sig("power", 8), sig("quiet", 8)]),
    { ...section("onsite-checklist", []) },
  ];

  test("финалната категория е преди чеклиста и се маха без цел", () => {
    const withIt = withPurposeSection(sections, "remote", "Работа от разстояние");
    expect(withIt.map((s) => s.id)).toEqual(["a", "purpose-fit", "onsite-checklist"]);
    expect(withPurposeSection(withIt, null, "").map((s) => s.id)).toEqual([
      "a",
      "onsite-checklist",
    ]);
  });

  test("сравнението смята по избраната цел от запазените сигнали", () => {
    const g = buildPurposeComparison(
      [
        { label: "A", sections },
        { label: "B", sections: [] },
      ],
      "remote",
      "Работа от разстояние",
    );
    expect(g.rows[0]!.cells[0]!.text).toContain("/ 10");
    expect(g.rows[0]!.cells[1]!.text).toBe("Недостатъчно данни");
    expect(collectSignals(sections)).toHaveLength(3);
  });
});

describe("цели и теми", () => {
  test("семейството тежи на педиатър, ясла и аптека; доклад без тях получава „липсват данни“", () => {
    const fit = computeFit([sig("education", 8), sig("safety", 8), sig("services", 7)], "family");
    expect(fit.unknown).toEqual(expect.arrayContaining(["pediatric", "childcare", "pharmacy"]));
  });

  test("финалната категория съдържа списък „Какво да проверите на място“", () => {
    const s = withPurposeSection([section("a", [sig("internet", 9)])], "family", "Семейство");
    const fitSection = s.find((x) => x.id === "purpose-fit")!;
    expect(
      fitSection.blocks.some((b) => b.kind === "list" && b.title === "Какво да проверите на място"),
    ).toBe(true);
  });
});
