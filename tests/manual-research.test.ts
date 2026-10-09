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

import { isCacheVersionValid, manualVersionFor } from "../src/lib/report-cache";

describe("isCacheVersionValid", () => {
  test("съвпадаща версия е валидна", () => {
    expect(isCacheVersionValid("3-abc", "3-abc")).toBe(true);
  });
  test("различна или липсваща версия е остаряла", () => {
    expect(isCacheVersionValid("2-abc", "3-abc")).toBe(false);
    expect(isCacheVersionValid(null, "3-abc")).toBe(false);
  });
  test("ръчно импортираните не остаряват при смяна на промпта", () => {
    expect(isCacheVersionValid(manualVersionFor("2-old"), "3-new")).toBe(true);
  });
});
