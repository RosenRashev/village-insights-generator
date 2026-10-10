import { describe, expect, test } from "bun:test";

import {
  checkListRule,
  checksFor,
  hideRule,
  mergeStatuses,
  needsFollowUp,
  parseCheckStatuses,
  pendingKeys,
  splitChecks,
  stripCheckLines,
  withChecks,
  type StoredChecks,
} from "../src/lib/fact-checks";

const text = `Има автобусна спирка на главната улица (общински сайт, 2026).

ПРОВЕРКА bus_station: ОТХВЪРЛЕНО
* ПРОВЕРКА train_stop: потвърдено
ПРОВЕРКА taxi: НЕПРОВЕРЕНО
ПРОВЕРКА непознат: ПОТВЪРДЕНО

ИЗТОЧНИЦИ:
- https://example.com/a`;

describe("parseCheckStatuses", () => {
  const st = parseCheckStatuses(text, "transport");

  test("чете статусите и търпи звездичка и малки букви", () => {
    expect(st.bus_station).toBe("denied");
    expect(st.train_stop).toBe("confirmed");
    expect(st.taxi).toBe("unverified");
  });

  test("липсваща точка е непроверена; непознат ключ се игнорира", () => {
    expect(st.intercity_bus).toBe("unverified");
    expect("непознат" in st).toBe(false);
  });

  test("категория без проверки дава празен резултат", () => {
    expect(parseCheckStatuses("ПРОВЕРКА x: ПОТВЪРДЕНО", "history")).toEqual({});
    expect(checkListRule("history")).toBe("");
  });
});

describe("stripCheckLines / pendingKeys / hideRule", () => {
  test("редовете ПРОВЕРКА се махат от текста", () => {
    const out = stripCheckLines(text);
    expect(out).not.toContain("ПРОВЕРКА");
    expect(out).toContain("Има автобусна спирка");
    expect(out).toContain("ИЗТОЧНИЦИ:");
  });

  test("непроверените се подреждат за скриване", () => {
    const st = parseCheckStatuses(text, "transport");
    expect(pendingKeys(st).sort()).toEqual(["intercity_bus", "taxi"]);
    const rule = hideRule("transport", st);
    expect(rule).toContain("НЕ ГИ ПОКАЗВАЙ");
    expect(rule).toContain("такси");
    expect(rule).not.toContain("автогара");
  });

  test("няма скриване, когато всичко е проверено", () => {
    const all = Object.fromEntries(checksFor("health").map((c) => [c.key, "confirmed" as const]));
    expect(hideRule("health", all)).toBe("");
  });
});

describe("mergeStatuses", () => {
  test("допроверката не връща потвърдено към непроверено", () => {
    const merged = mergeStatuses(
      { a: "confirmed", b: "unverified", c: "denied" },
      { a: "unverified", b: "denied", c: "unverified" },
    );
    expect(merged).toEqual({ a: "confirmed", b: "denied", c: "denied" });
  });
});

describe("withChecks / splitChecks / needsFollowUp", () => {
  const checks: StoredChecks = {
    statuses: { bus_station: "unverified", taxi: "confirmed" },
    research: "текст",
    followUpDone: false,
  };

  test("_checks се отделя от данните и не изтича", () => {
    const stored = withChecks({ id: "transport", blocks: [] }, checks);
    const { data, checks: back } = splitChecks(stored);
    expect(data).toEqual({ id: "transport", blocks: [] });
    expect(back).toEqual(checks);
  });

  test("данни без _checks връщат null", () => {
    expect(splitChecks({ id: "x" }).checks).toBeNull();
  });

  test("допроверка само веднъж и само за малки места", () => {
    expect(needsFollowUp(checks, false)).toBe(true);
    expect(needsFollowUp(checks, true)).toBe(false);
    expect(needsFollowUp({ ...checks, followUpDone: true }, false)).toBe(false);
    expect(needsFollowUp({ ...checks, statuses: { a: "confirmed" } }, false)).toBe(false);
    expect(needsFollowUp(null, false)).toBe(false);
  });
});
