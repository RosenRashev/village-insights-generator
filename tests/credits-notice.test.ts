import { describe, expect, test } from "bun:test";

import { creditNotice, reportsWord } from "../src/lib/credits-notice";

describe("creditNotice", () => {
  test("първо виждане с доклади дава приветствие, без доклади — нищо", () => {
    expect(creditNotice(null, 3)).toEqual({ kind: "welcome", credits: 3 });
    expect(creditNotice(null, 0)).toEqual({ kind: "none" });
  });

  test("по-голям брой от последно видения е „заредени“", () => {
    expect(creditNotice(0, 2)).toEqual({ kind: "added", added: 2, credits: 2 });
    expect(creditNotice(1, 6)).toEqual({ kind: "added", added: 5, credits: 6 });
  });

  test("същият или по-малък брой (изразходвани) не дава известие", () => {
    expect(creditNotice(3, 3)).toEqual({ kind: "none" });
    expect(creditNotice(3, 1)).toEqual({ kind: "none" });
    expect(creditNotice(1, 0)).toEqual({ kind: "none" });
  });
});

describe("reportsWord", () => {
  test("единствено и множествено число", () => {
    expect(reportsWord(1)).toBe("1 доклад");
    expect(reportsWord(2)).toBe("2 доклада");
    expect(reportsWord(5)).toBe("5 доклада");
  });
});
