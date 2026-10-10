import { describe, expect, test } from "bun:test";

import { reasonLabel, signed, timeAgo } from "../src/lib/credit-labels";

describe("credit-labels", () => {
  test("етикети за причините", () => {
    expect(reasonLabel("report")).toBe("Нов доклад");
    expect(reasonLabel("welcome")).toContain("Безплатен");
    expect(reasonLabel("непознато")).toBe("непознато");
  });

  test("знак пред числото", () => {
    expect(signed(2)).toBe("+2");
    expect(signed(-1)).toBe("-1");
    expect(signed(0)).toBe("0");
  });

  test("относително време", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(timeAgo("2026-10-10T11:59:40Z", now)).toBe("сега");
    expect(timeAgo("2026-10-10T11:55:00Z", now)).toBe("преди 5 мин");
    expect(timeAgo("2026-10-10T09:00:00Z", now)).toBe("преди 3 ч");
    expect(timeAgo("2026-10-09T10:00:00Z", now)).toBe("вчера");
    expect(timeAgo("2026-10-07T12:00:00Z", now)).toBe("преди 3 дни");
  });
});
