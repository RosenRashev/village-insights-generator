import type { ReportBlock, ReportSection } from "@/data/mock-report";
import type { PurposeId } from "@/lib/prompt-modules";
import { collectSignals, computeFit, TOPICS, VERDICT_TEXT, type TopicId } from "@/lib/purpose-fit";
import { normalize, type Settlement } from "@/lib/settlements";

/**
 * Сравнение на населени места от вече запазени доклади — без заявки към Gemini.
 * Не се филтрира информация: всеки блок от доклада става ред в таблицата, като дългите
 * текстове и списъци се показват компактно (свиват се в интерфейса).
 */

export type CompareLevel = "good" | "fair" | "poor";

export type CompareCell = {
  /** Основна кратка стойност. */
  text?: string;
  /** Допълнително (обикновено по-дълго) пояснение. */
  note?: string;
  /** Кратки редове — елементи на списък, разстояния, разписание, дялове. */
  lines?: string[];
  level?: CompareLevel;
};

export type CompareRow = { label: string; cells: (CompareCell | null)[] };
export type CompareGroup = { id: string; title: string; rows: CompareRow[] };

export type ComparePlace = {
  label: string;
  place?: Settlement | null | undefined;
  sections: ReportSection[];
};

type Entry = { label: string; cell: CompareCell };

const RISK_TEXT = { low: "нисък", medium: "среден", high: "висок" } as const;
const RISK_LEVEL: Record<"low" | "medium" | "high", CompareLevel> = {
  low: "good",
  medium: "fair",
  high: "poor",
};
const TONE_LEVEL: Partial<Record<string, CompareLevel>> = {
  emerald: "good",
  teal: "good",
  amber: "fair",
  rose: "poor",
};

const clean = (s: string | undefined): string | undefined => {
  const t = s?.trim();
  return t ? t : undefined;
};

/** Само ненулевите полета, за да отговаря на `exactOptionalPropertyTypes`. */
function cell(c: {
  text?: string | undefined;
  note?: string | undefined;
  lines?: string[] | undefined;
  level?: CompareLevel | undefined;
}): CompareCell {
  const out: CompareCell = {};
  const text = clean(c.text);
  const note = clean(c.note);
  const lines = c.lines?.map((l) => l.trim()).filter(Boolean);
  if (text) out.text = text;
  if (note) out.note = note;
  if (lines && lines.length > 0) out.lines = lines;
  if (c.level) out.level = c.level;
  return out;
}

function blockEntries(block: ReportBlock): Entry[] {
  switch (block.kind) {
    case "facts":
      return block.items.map((it) => ({
        label: it.label,
        cell: cell({
          text: it.value,
          note: [it.description, it.pillValue ? `${it.pillLabel ?? ""} ${it.pillValue}` : ""]
            .filter(Boolean)
            .join(" · "),
        }),
      }));

    case "scale":
      return block.items.map((it) => ({
        label: it.label,
        cell: cell({ text: it.levelText, note: it.note, level: it.level }),
      }));

    case "risks":
      return block.items.map((it) => ({
        label: it.label,
        cell: cell({
          text: `${RISK_TEXT[it.level]}${it.incidentCount ? ` · ${it.incidentCount} случая` : ""}`,
          note: it.note,
          level: RISK_LEVEL[it.level],
        }),
      }));

    case "gauge": {
      const sign = block.direction === "down" ? "−" : block.direction === "up" ? "+" : "";
      return [
        {
          label: block.title,
          cell: cell({
            text: `${sign}${block.value}%${block.periodLabel ? ` (${block.periodLabel})` : ""}`,
            note: block.note,
            level:
              block.direction === "up" ? "good" : block.direction === "down" ? "poor" : undefined,
          }),
        },
      ];
    }

    case "bars": {
      const first = block.data[0];
      const last = block.data[block.data.length - 1];
      if (!first || !last) return [];
      const unit = block.unit ? ` ${block.unit}` : "";
      return [
        {
          label: block.title,
          cell: cell({
            text:
              first === last
                ? `${last.value}${unit} (${last.label})`
                : `${first.value} → ${last.value}${unit}`,
            note: block.data.map((d) => `${d.label}: ${d.value}`).join(" · "),
            level: first === last ? undefined : last.value >= first.value ? "good" : "poor",
          }),
        },
      ];
    }

    case "pie":
      return [
        {
          label: block.title,
          cell: cell({ lines: block.data.map((d) => `${d.name} — ${d.value}%`) }),
        },
      ];

    case "distances":
      return [
        {
          label: block.title ?? "Разстояния",
          cell: cell({
            lines: block.rows.map(
              (r) =>
                `${r.to}: ${r.distance}${r.driveTime ? `, ${r.driveTime}` : ""}${r.road ? ` (${r.road})` : ""}`,
            ),
          }),
        },
      ];

    case "schedule":
      return [
        {
          label: block.title,
          cell: cell({
            lines: block.rows.map(
              (r) => `${r.route}: ${r.days}, ${r.runs}${r.last ? ` (последен ${r.last})` : ""}`,
            ),
          }),
        },
      ];

    case "cards":
      return block.items.map((it) => ({
        label: it.label,
        cell: cell({ note: it.body, level: TONE_LEVEL[it.tone] }),
      }));

    case "text":
      return [
        {
          label: block.title ?? "Описание",
          cell: cell({ note: block.body, level: block.tone ? TONE_LEVEL[block.tone] : undefined }),
        },
      ];

    case "list":
      return [
        {
          label: block.title ?? "Списък",
          cell: cell({
            lines: block.items,
            level: block.tone ? TONE_LEVEL[block.tone] : undefined,
          }),
        },
      ];

    case "checklist":
      return block.items.map((it) => ({ label: it.title, cell: cell({ lines: it.points }) }));

    default:
      return [];
  }
}

/** Редове и групи се сравняват по нормализирано заглавие (без регистър и пунктуация). */
type PlaceData = { groups: Map<string, { title: string; entries: Map<string, Entry> }> };

function collect(p: ComparePlace): PlaceData {
  const groups: PlaceData["groups"] = new Map();
  const group = (id: string, title: string) => {
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { title, entries: new Map() }));
    return g;
  };

  if (p.place) {
    const g = group("general", "Общи данни");
    g.entries.set("obshtina", { label: "Община", cell: cell({ text: p.place.municipality }) });
    g.entries.set("oblast", { label: "Област", cell: cell({ text: p.place.province }) });
    if (typeof p.place.population === "number") {
      g.entries.set("naselenie", {
        label: "Население (НСИ)",
        cell: cell({ text: `${p.place.population.toLocaleString("bg-BG")} души` }),
      });
    }
  }

  for (const section of p.sections) {
    if (section.id === "onsite-checklist") continue;
    const g = group(section.id, section.title);
    const seen = new Map<string, number>();
    for (const block of section.blocks) {
      for (const e of blockEntries(block)) {
        const base = `${block.kind === "facts" ? "f" : block.kind}|${normalize(e.label)}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        g.entries.set(n === 1 ? base : `${base}#${n}`, e);
      }
    }
  }
  return { groups };
}

/** Подрежда всичко от докладите на няколко места в общи редове, групирани по категория. */
export function buildComparison(places: ComparePlace[]): CompareGroup[] {
  const data = places.map(collect);

  const groupIds: string[] = [];
  for (const d of data)
    for (const id of d.groups.keys()) if (!groupIds.includes(id)) groupIds.push(id);

  const out: CompareGroup[] = [];
  for (const id of groupIds) {
    const title = data.map((d) => d.groups.get(id)?.title).find(Boolean) ?? id;
    const keys: string[] = [];
    for (const d of data) {
      for (const key of d.groups.get(id)?.entries.keys() ?? []) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
    const rows: CompareRow[] = keys.map((key) => {
      const entries = data.map((d) => d.groups.get(id)?.entries.get(key) ?? null);
      const first = entries.find((e) => e !== null)!;
      return { label: first.label, cells: entries.map((e) => e?.cell ?? null) };
    });
    if (rows.length > 0) out.push({ id, title, rows });
  }
  return out;
}

const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** Горна група „Оценка за <цел>“: оценка, надеждност, плюсове, минуси и липсващи данни за всяко място. */
export function buildPurposeComparison(
  places: ComparePlace[],
  purpose: PurposeId,
  purposeLabel: string,
): CompareGroup {
  const fits = places.map((p) => computeFit(collectSignals(p.sections), purpose));
  const names = (signals: { topic: TopicId }[]) => signals.map((s) => capital(TOPICS[s.topic]));
  const linesCell = (lines: string[]): CompareCell | null =>
    lines.length ? cell({ lines }) : null;
  const rows: CompareRow[] = [
    {
      label: "Оценка (1–10)",
      cells: fits.map((f) =>
        f.score === null || f.verdict === null
          ? cell({ text: "Недостатъчно данни", note: "Липсата на данни не е лош знак." })
          : cell({
              text: `${f.score.toFixed(1)} / 10`,
              note: VERDICT_TEXT[f.verdict],
              level: f.score >= 6.3 ? "good" : f.score >= 5 ? "fair" : "poor",
            }),
      ),
    },
    {
      label: "Надеждност",
      cells: fits.map((f) =>
        cell({
          text: { high: "Висока", medium: "Средна", low: "Ниска" }[f.confidence],
          note: `Данни за ${Math.round(f.coverage * 100)}% от важните теми`,
        }),
      ),
    },
    { label: "Плюсове", cells: fits.map((f) => linesCell(names(f.pros))) },
    { label: "Минуси", cells: fits.map((f) => linesCell(names(f.cons))) },
    {
      label: "Липсват данни",
      cells: fits.map((f) => linesCell(names(f.unknown.map((topic) => ({ topic }))))),
    },
  ];
  return { id: "purpose-fit", title: `Оценка за „${purposeLabel}“`, rows };
}
