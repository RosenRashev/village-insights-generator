import { describe, expect, test } from "bun:test";

import { safeRedirect } from "../src/lib/redirect";

describe("safeRedirect", () => {
  test("допуска вътрешни пътища със заявка и котва", () => {
    expect(safeRedirect("/admin/users/abc?x=1#y")).toBe("/admin/users/abc?x=1#y");
    expect(safeRedirect("/report/702")).toBe("/report/702");
  });

  test("отхвърля външни и подвеждащи адреси", () => {
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("/\\evil.com")).toBe("/");
    expect(safeRedirect("javascript:alert(1)")).toBe("/");
    expect(safeRedirect("/ok\nSet-Cookie: x")).toBe("/");
  });

  test("без стойност, не-низ или към /vhod връща резервния", () => {
    expect(safeRedirect(undefined)).toBe("/");
    expect(safeRedirect(42)).toBe("/");
    expect(safeRedirect("")).toBe("/");
    expect(safeRedirect("/vhod?redirect=/x")).toBe("/");
    expect(safeRedirect("/x", "/home")).toBe("/x");
    expect(safeRedirect("nope", "/home")).toBe("/home");
  });
});
