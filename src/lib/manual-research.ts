import { PROMPT_MODULES } from "@/lib/prompt-modules";
import type { SourceLink } from "@/lib/report-cache";

/** Една категория от ръчно проучване: суров текст (без блока ИЗТОЧНИЦИ) + извадените връзки. */
export type ManualCategory = {
  id: string;
  text: string;
  sources: SourceLink[];
};

export type ParsedManualResearch = {
  categories: ManualCategory[];
  /** Заглавия `## КАТЕГОРИЯ: x` с непознат идентификатор — пропускат се. */
  unknownIds: string[];
  /** Известни категории, които липсват във файла. */
  missingIds: string[];
  /** Категории със заглавие, но без текст. */
  emptyIds: string[];
};

const HEADING = /^\s*#{1,4}\s*(?:\*\*)?\s*КАТЕГОРИЯ\s*:\s*([A-Za-z-]+)\s*(?:\*\*)?\s*$/i;
const SOURCES_LABEL = /^\s*(?:[*_#>\s-]*)ИЗТОЧНИЦИ\s*:?\s*(?:[*_]*)\s*$/i;
const URL_RE = /https?:\/\/[^\s)<>\]"'`]+/g;

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:!?]+$/, "");
}

function labelFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Разцепва залепения отговор на Gemini по `## КАТЕГОРИЯ: <id>`.
 * Търпи блокове с код (```), `*` вместо `-` за булети, разделители `---`
 * и текст преди първото заглавие (игнорира се).
 */
export function parseManualResearch(markdown: string): ParsedManualResearch {
  const known = new Set(PROMPT_MODULES.map((m) => m.id));
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  const blocks: { id: string; lines: string[] }[] = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) continue;
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ id: h[1]!.toLowerCase(), lines: [] });
      continue;
    }
    blocks.at(-1)?.lines.push(line);
  }

  const byId = new Map<string, ManualCategory>();
  const unknownIds: string[] = [];
  const emptyIds: string[] = [];

  for (const block of blocks) {
    if (!known.has(block.id)) {
      unknownIds.push(block.id);
      continue;
    }
    const split = block.lines.findIndex((l) => SOURCES_LABEL.test(l));
    const bodyLines = split === -1 ? block.lines : block.lines.slice(0, split);
    const sourceLines = split === -1 ? [] : block.lines.slice(split + 1);

    const text = bodyLines
      .filter((l) => !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(l))
      .join("\n")
      .trim();

    const seen = new Set<string>();
    const sources: SourceLink[] = [];
    for (const m of sourceLines.join("\n").matchAll(URL_RE)) {
      const url = cleanUrl(m[0]);
      if (seen.has(url)) continue;
      seen.add(url);
      sources.push({ label: labelFor(url), url });
    }

    if (!text) {
      emptyIds.push(block.id);
      continue;
    }
    // При повторено заглавие печели по-дългият текст (напр. частично повторен отговор).
    const prev = byId.get(block.id);
    if (!prev || text.length > prev.text.length) {
      byId.set(block.id, { id: block.id, text, sources });
    }
  }

  const categories = PROMPT_MODULES.map((m) => byId.get(m.id)).filter(
    (c): c is ManualCategory => c !== undefined,
  );
  const missingIds = PROMPT_MODULES.map((m) => m.id).filter((id) => !byId.has(id));
  return { categories, unknownIds, missingIds, emptyIds };
}
