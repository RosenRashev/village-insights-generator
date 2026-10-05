import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CompareCell, CompareGroup, CompareLevel } from "@/lib/compare";

const LEVEL_STYLE: Record<CompareLevel, string> = {
  good: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  fair: "bg-amber-50 text-amber-900 ring-amber-200",
  poor: "bg-rose-50 text-rose-900 ring-rose-200",
};

const NOTE_LIMIT = 90;
const LINES_VISIBLE = 3;

/** Дълъг текст — свит до 2 реда, с „още“ за пълния. */
function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > NOTE_LIMIT;
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      <span className={open || !long ? "" : "line-clamp-2"}>{text}</span>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-medium text-primary hover:underline print:hidden"
        >
          {open ? "по-малко" : "още"}
        </button>
      )}
    </p>
  );
}

function Lines({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? lines : lines.slice(0, LINES_VISIBLE);
  const hidden = lines.length - shown.length;
  return (
    <div>
      <ul className="space-y-0.5 text-[11px] leading-snug">
        {shown.map((l, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      {lines.length > LINES_VISIBLE && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          {open ? "по-малко" : `+${hidden} още`}
        </button>
      )}
    </div>
  );
}

function CellView({ cell }: { cell: CompareCell | null }): ReactNode {
  if (!cell) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1">
      {cell.text && (
        <span
          className={
            cell.level
              ? `inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ${LEVEL_STYLE[cell.level]}`
              : "text-xs font-medium"
          }
        >
          {cell.text}
        </span>
      )}
      {cell.note && <Expandable text={cell.note} />}
      {cell.lines && <Lines lines={cell.lines} />}
    </div>
  );
}

type Props = {
  groups: CompareGroup[];
  /** Заглавния ред с имената на местата (колоните след първата). */
  header: ReactNode;
  columns: number;
};

/** Компактна таблица: категориите се свиват/разгъват, дългите текстове и списъци се скъсяват. */
export function CompareTable({ groups, header, columns }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allCollapsed = collapsed.size === groups.length;

  return (
    <div>
      <div className="mb-2 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.id)))}
          className="text-xs font-medium text-primary hover:underline"
        >
          {allCollapsed ? "Разгъни всички категории" : "Свий всички категории"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-32 sm:w-40" />
            {Array.from({ length: columns }, (_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>{header}</thead>
          <tbody>
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.id);
              return [
                <tr key={`g-${g.id}`} className="bg-muted/60">
                  <td colSpan={columns + 1} className="p-0">
                    <button
                      type="button"
                      onClick={() => toggle(g.id)}
                      aria-expanded={!isCollapsed}
                      className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {g.title}
                      <span className="ml-1 font-normal normal-case opacity-70">
                        ({g.rows.length})
                      </span>
                    </button>
                  </td>
                </tr>,
                ...(isCollapsed
                  ? []
                  : g.rows.map((row, ri) => (
                      <tr key={`${g.id}-${ri}`} className="border-t border-border/60">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left align-top text-xs font-medium text-foreground"
                        >
                          {row.label}
                        </th>
                        {row.cells.map((c, i) => (
                          <td key={i} className="px-3 py-1.5 align-top">
                            <CellView cell={c} />
                          </td>
                        ))}
                      </tr>
                    ))),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
