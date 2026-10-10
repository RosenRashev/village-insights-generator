import { describe, expect, test } from "bun:test";

import { checkDiagAuth, safeEqual } from "../src/lib/diag-auth";

const TOKEN = "0123456789abcdef0123";

describe("checkDiagAuth", () => {
  test("без (или със къс) ключ в средата маршрутът е изключен", () => {
    expect(checkDiagAuth(`Bearer ${TOKEN}`, undefined)).toBe("disabled");
    expect(checkDiagAuth(`Bearer short`, "short")).toBe("disabled");
  });

  test("липсваща или грешна заглавка е отказ", () => {
    expect(checkDiagAuth(null, TOKEN)).toBe("denied");
    expect(checkDiagAuth("Bearer nope", TOKEN)).toBe("denied");
    expect(checkDiagAuth(TOKEN, TOKEN)).toBe("denied");
  });

  test("верният ключ минава", () => {
    expect(checkDiagAuth(`Bearer ${TOKEN}`, TOKEN)).toBe("ok");
    expect(checkDiagAuth(`bearer  ${TOKEN} `, TOKEN)).toBe("ok");
  });

  test("safeEqual сравнява по дължина и съдържание", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
