import { describe, expect, test } from "bun:test";

import { transportLayout } from "../src/lib/report-generator.server";

describe("transportLayout", () => {
  test("за село етикетите са „от селото“", () => {
    const text = transportLayout("village");
    expect(text).toContain('"Изходи от селото"');
    expect(text).toContain('"ЖП спирка в селото"');
  });

  test("за град няма „селото“, а „града“", () => {
    const text = transportLayout("town");
    expect(text).toContain('"Изходи от града"');
    expect(text).toContain('"ЖП спирка в града"');
    expect(text).not.toContain("селото");
  });

  test("за квартал — „квартала“", () => {
    expect(transportLayout("district")).toContain('"Изходи от квартала"');
  });
});
