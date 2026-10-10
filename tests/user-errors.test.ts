import { describe, expect, test } from "bun:test";

import { GENERIC_ERROR, toUserMessage } from "../src/lib/user-errors";
import { isSafeHttpUrl, safeSources } from "../src/lib/safe-url";

describe("toUserMessage", () => {
  test("превежда познатите грешки на Supabase Auth", () => {
    expect(toUserMessage(new Error("Invalid login credentials"))).toBe("Грешен имейл или парола.");
    expect(toUserMessage(new Error("User already registered"))).toContain("вече има регистрация");
    expect(toUserMessage(new Error("Auth session missing!"))).toContain("Сесията");
    expect(toUserMessage(new Error("Email rate limit exceeded"))).toContain("Твърде много");
    expect(toUserMessage(new TypeError("Failed to fetch"))).toContain("връзка");
  });

  test("български текст от сървъра се показва както е", () => {
    expect(toUserMessage(new Error("Нямате права за тази операция."))).toBe(
      "Нямате права за тази операция.",
    );
  });

  test("неразпознат английски/технически текст не изтича", () => {
    expect(toUserMessage(new Error("duplicate key value violates unique constraint x"))).toBe(
      GENERIC_ERROR,
    );
    expect(toUserMessage(undefined, "Грешка")).toBe("Грешка");
  });
});

describe("safe-url", () => {
  test("само http и https", () => {
    expect(isSafeHttpUrl("https://example.com/a")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
    expect(isSafeHttpUrl("не е адрес")).toBe(false);
  });

  test("safeSources филтрира опасните", () => {
    const res = safeSources([{ url: "https://a.bg" }, { url: "data:x" }, { url: "ftp://b" }]);
    expect(res.map((s) => s.url)).toEqual(["https://a.bg"]);
    expect(safeSources(null)).toEqual([]);
  });
});
