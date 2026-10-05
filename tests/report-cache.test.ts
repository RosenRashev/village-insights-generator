import { describe, expect, test } from "bun:test";

import { expiresAtFor, isFresh, ttlDaysFor } from "../src/lib/report-cache";

describe("кеш", () => {
  test("основната категория не изтича", () => {
    expect(expiresAtFor("basic")).toBeNull();
    expect(isFresh(null)).toBe(true);
  });

  test("социалният живот изтича след 7 дни", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(expiresAtFor("social", from)).toBe("2026-01-08T00:00:00.000Z");
  });

  test("непозната категория има TTL по подразбиране", () => {
    expect(ttlDaysFor("нещо")).toBe(30);
  });

  test("изтекъл запис не е свеж", () => {
    expect(isFresh("2000-01-01T00:00:00.000Z")).toBe(false);
    expect(isFresh(undefined)).toBe(false);
  });
});
