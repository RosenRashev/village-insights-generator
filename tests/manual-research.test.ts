import { describe, expect, test } from "bun:test";

import { parseManualResearch } from "../src/lib/manual-research";

const sample = `Някакво въведение
\`\`\`markdown
## КАТЕГОРИЯ: basic
* Височина ~220 м.
* Път до Пловдив.

---

ИЗТОЧНИЦИ:
* https://example.com/a.
- https://www.nsi.bg/x?y=1
- https://example.com/a

## КАТЕГОРИЯ: vik
Водата е добра.

**ИЗТОЧНИЦИ:**
- https://vik.bg/b

## КАТЕГОРИЯ: nosuch
Нещо.

## КАТЕГОРИЯ: ethnos
\`\`\`
`;

describe("parseManualResearch", () => {
  const r = parseManualResearch(sample);

  test("разцепва по категории и пропуска въведението и оградите", () => {
    expect(r.categories.map((c) => c.id)).toEqual(["basic", "vik"]);
    expect(r.categories[0]!.text).toContain("Височина ~220 м.");
    expect(r.categories[0]!.text).not.toContain("ИЗТОЧНИЦИ");
    expect(r.categories[0]!.text).not.toContain("---");
  });

  test("вади връзките без повторения и без крайна пунктуация", () => {
    expect(r.categories[0]!.sources.map((s) => s.url)).toEqual([
      "https://example.com/a",
      "https://www.nsi.bg/x?y=1",
    ]);
    expect(r.categories[0]!.sources[1]!.label).toBe("nsi.bg");
    expect(r.categories[1]!.sources.map((s) => s.url)).toEqual(["https://vik.bg/b"]);
  });

  test("отчита непознати, празни и липсващи категории", () => {
    expect(r.unknownIds).toEqual(["nosuch"]);
    expect(r.emptyIds).toEqual(["ethnos"]);
    expect(r.missingIds).toContain("history");
    expect(r.missingIds).not.toContain("basic");
  });

  test("празен вход не дава категории", () => {
    expect(parseManualResearch("").categories).toEqual([]);
  });
});
