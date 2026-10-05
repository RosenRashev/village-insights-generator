import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Award,
  Bus,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Droplet,
  Globe,
  Hourglass,
  Landmark,
  Leaf,
  Lightbulb,
  MapPin,
  MessagesSquare,
  Minus,
  Newspaper,
  Printer,
  Route,
  ShieldHalf,
  Stethoscope,
  Target,
  ThumbsDown,
  ThumbsUp,
  TreePine,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  Wind,
  Zap,
  type LucideIcon,
  Info,
} from "lucide-react";
import { summaryChips, type SummaryChip } from "@/lib/section-summary";
import {
  checklistsToLists,
  layoutBasicBlocks,
  layoutEthnosBlocks,
  layoutHistoryBlocks,
  sortBlocksBySize,
} from "@/lib/report-layout";

/**
 * Категории с изрично зададена, ръчна подредба на блоковете в промпта
 * (и/или в кода) — за тях НЕ се прилага автоматичната подредба по размер,
 * защото конкретният им ред е нарочно различен (напр. ВиК умишлено показва
 * скалите над кутийките).
 */
const HAS_BESPOKE_LAYOUT = new Set(["basic", "vik", "ethnos", "transport", "security", "services"]);
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  MOCK_REPORT,
  MOCK_REPORT_PLACE,
  type CardTone,
  type ReportBlock,
  type ReportSection,
  type RiskLevel,
  type SourceLink,
} from "@/data/mock-report";
import "leaflet/dist/leaflet.css";

import { LocationMap } from "@/components/LocationMap";
import { useAuth } from "@/hooks/useAuth";
import { isPremium } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Settlement } from "@/lib/settlements";
import { displaySettlement } from "@/lib/settlements";
import { PURPOSE_INSIGHTS } from "@/lib/purpose-insights";
import type { PurposeId } from "@/lib/prompt-modules";

const ICONS: Record<string, LucideIcon> = {
  basic: Route,
  vik: Droplet,
  ethnos: Users,
  transport: Bus,
  power: Zap,
  security: ShieldHalf,
  services: Stethoscope,
  connectivity: Wifi,
  industry: TrendingUp,
  social: MessagesSquare,
  culture: Landmark,
  history: Hourglass,
  risks: Leaf,
  environment: Wind,
  "onsite-checklist": ClipboardCheck,
};

type Theme = ReportSection["theme"];

const THEMES: Record<
  Theme,
  { accent: string; soft: string; ink: string; box: string; hover: string }
> = {
  emerald: {
    accent: "#059669",
    soft: "#ecfdf5",
    ink: "#064e3b",
    box: "bg-emerald-500",
    hover: "hover:border-emerald-300",
  },
  sky: {
    accent: "#0284c7",
    soft: "#f0f9ff",
    ink: "#0c4a6e",
    box: "bg-sky-500",
    hover: "hover:border-sky-300",
  },
  amber: {
    accent: "#d97706",
    soft: "#fffbeb",
    ink: "#78350f",
    box: "bg-amber-500",
    hover: "hover:border-amber-300",
  },
  violet: {
    accent: "#7c3aed",
    soft: "#f5f3ff",
    ink: "#3b0764",
    box: "bg-violet-500",
    hover: "hover:border-violet-300",
  },
  rose: {
    accent: "#e11d48",
    soft: "#fff1f2",
    ink: "#881337",
    box: "bg-rose-500",
    hover: "hover:border-rose-300",
  },
  teal: {
    accent: "#0d9488",
    soft: "#f0fdfa",
    ink: "#134e4a",
    box: "bg-teal-500",
    hover: "hover:border-teal-300",
  },
  indigo: {
    accent: "#4f46e5",
    soft: "#eef2ff",
    ink: "#312e81",
    box: "bg-indigo-500",
    hover: "hover:border-indigo-300",
  },
  orange: {
    accent: "#ea580c",
    soft: "#fff7ed",
    ink: "#7c2d12",
    box: "bg-orange-500",
    hover: "hover:border-orange-300",
  },
  lime: {
    accent: "#65a30d",
    soft: "#f7fee7",
    ink: "#365314",
    box: "bg-lime-600",
    hover: "hover:border-lime-300",
  },
  cyan: {
    accent: "#0891b2",
    soft: "#ecfeff",
    ink: "#164e63",
    box: "bg-cyan-500",
    hover: "hover:border-cyan-300",
  },
  fuchsia: {
    accent: "#c026d3",
    soft: "#fdf4ff",
    ink: "#701a75",
    box: "bg-fuchsia-500",
    hover: "hover:border-fuchsia-300",
  },
  slate: {
    accent: "#475569",
    soft: "#f8fafc",
    ink: "#0f172a",
    box: "bg-slate-600",
    hover: "hover:border-slate-400",
  },
};

const RISK: Record<
  RiskLevel,
  { label: string; color: string; percent: number; bar: string; pill: string }
> = {
  low: {
    label: "Нисък",
    color: "#16a34a",
    percent: 20,
    bar: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
  },
  medium: {
    label: "Среден",
    color: "#d97706",
    percent: 50,
    bar: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800",
  },
  high: {
    label: "Висок",
    color: "#dc2626",
    percent: 85,
    bar: "bg-rose-500",
    pill: "bg-rose-100 text-rose-700",
  },
};

const SCALE_LEVELS: Record<"good" | "fair" | "poor", { tone: CardTone; bar: string }> = {
  good: { tone: "emerald", bar: "bg-emerald-500" },
  fair: { tone: "amber", bar: "bg-amber-500" },
  poor: { tone: "rose", bar: "bg-rose-500" },
};

const CARD_TONES: Record<CardTone, { bg: string; border: string; ink: string; icon: string }> = {
  emerald: { bg: "#ecfdf5", border: "#a7f3d0", ink: "#064e3b", icon: "#059669" },
  sky: { bg: "#f0f9ff", border: "#bae6fd", ink: "#0c4a6e", icon: "#0284c7" },
  blue: { bg: "#eff6ff", border: "#bfdbfe", ink: "#1e3a8a", icon: "#2563eb" },
  amber: { bg: "#fffbeb", border: "#fde68a", ink: "#78350f", icon: "#d97706" },
  violet: { bg: "#f5f3ff", border: "#ddd6fe", ink: "#3b0764", icon: "#7c3aed" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", ink: "#581c87", icon: "#9333ea" },
  rose: { bg: "#fff1f2", border: "#fecdd3", ink: "#881337", icon: "#e11d48" },
  teal: { bg: "#f0fdfa", border: "#99f6e4", ink: "#134e4a", icon: "#0d9488" },
};

const CARD_ICONS: Record<string, LucideIcon> = {
  "thumbs-up": ThumbsUp,
  "thumbs-down": ThumbsDown,
  people: Users,
  globe: Globe,
  nature: TreePine,
  alert: AlertTriangle,
  news: Newspaper,
};

const GAUGE_DIRECTION = {
  up: { color: "#059669", Icon: TrendingUp },
  down: { color: "#e11d48", Icon: TrendingDown },
  neutral: { color: "#64748b", Icon: Minus },
} as const;

function SourceArrow({ sources }: { sources?: SourceLink[] | undefined }) {
  if (!sources || sources.length === 0) return null;
  const first = sources[0]!;
  return (
    <a
      href={first.url}
      target="_blank"
      rel="noopener noreferrer"
      title={sources.map((s) => `${s.label} — ${s.url}`).join("\n")}
      aria-label={`Източник: ${first.label}`}
      className="ml-1 inline-block align-super text-[10px] leading-none text-black/30 transition-opacity hover:text-black/70"
    >
      ↗
    </a>
  );
}

/** „i“ бутон: при посочване (или докосване) показва пояснение. Рисува се в портал, за да не се реже от таблицата. */
function InfoTip({ text, label }: { text: string; label: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const WIDTH = 288;

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - WIDTH / 2),
      window.innerWidth - WIDTH - 8,
    );
    setPos({ top: r.bottom + 8, left });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`Информация: ${label}`}
        className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-sky-600 transition hover:bg-sky-100 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 print:hidden"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (pos ? hide() : show())}
      >
        <Info className="h-4 w-4" />
      </button>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH }}
            className="z-50 rounded-xl bg-slate-900 p-3 text-sm font-normal leading-relaxed text-slate-100 shadow-xl"
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}

/** Карта за подкатегория: заглавие по средата (2× по-голямо от текста), по избор оцветена. */
function SubCard({
  title,
  tone,
  children,
}: {
  title?: string | undefined;
  tone?: CardTone | undefined;
  children: ReactNode;
}) {
  const t = tone ? CARD_TONES[tone] : null;
  return (
    <div
      className="print-card rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6"
      style={t ? { backgroundColor: t.bg, borderColor: t.border } : undefined}
    >
      {title && (
        <h4
          className="mb-4 text-center text-2xl font-bold leading-tight text-slate-900 md:text-3xl"
          style={t ? { color: t.ink } : undefined}
        >
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

function Block({
  block,
  accent,
  ink,
  hover = "",
}: {
  block: ReportBlock;
  accent: string;
  ink: string;
  hover?: string;
}) {
  switch (block.kind) {
    case "facts":
      return (
        <div
          className={
            block.featured
              ? "grid grid-cols-1 gap-4 text-xs sm:grid-cols-3"
              : "grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4"
          }
        >
          {block.title && (
            <h4 className="col-span-full text-lg font-bold text-slate-800">{block.title}</h4>
          )}
          {block.items.map((f) => (
            <div
              key={f.label}
              className={`print-card flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 transition md:p-5 ${f.size === "md" ? "sm:col-span-2" : ""} ${hover}`}
            >
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {f.label}
                </span>
                <span
                  className={`block font-bold text-slate-800 ${block.featured ? "text-3xl" : f.size === "md" ? "text-2xl" : "text-xl"}`}
                >
                  {f.value}
                  <SourceArrow sources={f.sources} />
                </span>
                {f.description && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {f.description}
                  </p>
                )}
              </div>
              {f.pillValue && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
                  <span className="text-[11px] font-medium text-slate-400">
                    {f.pillLabel ?? "Стойност"}
                  </span>
                  <span
                    className="shrink-0 rounded-md px-2.5 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: `${accent}1a`, color: ink }}
                  >
                    {f.pillValue}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case "gauge": {
      const dir = GAUGE_DIRECTION[block.direction];
      const value = Math.max(0, Math.min(100, block.value));
      return (
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
            {block.title}
          </h4>
          <div className="print-card flex flex-col items-center gap-4 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: block.title, value },
                      { name: "остатък", value: 100 - value },
                    ]}
                    dataKey="value"
                    innerRadius="80%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill={dir.color} />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <dir.Icon className="mb-1 h-7 w-7" style={{ color: dir.color }} />
                <span className="text-xl font-black text-black/80">
                  {block.direction === "down" ? "-" : block.direction === "up" ? "+" : ""}
                  {value}%
                </span>
                {block.periodLabel && (
                  <span className="line-clamp-2 max-w-[5.5rem] text-balance break-words px-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-black/40">
                    {block.periodLabel}
                  </span>
                )}
              </div>
            </div>
            {block.note && (
              <p className="text-center text-base leading-relaxed text-black/70 sm:text-left">
                {block.note}
              </p>
            )}
          </div>
        </div>
      );
    }

    case "cards":
      return (
        <div>
          {block.title && (
            <h4
              className="mb-2 text-sm font-bold uppercase tracking-wide"
              style={{ color: accent }}
            >
              {block.title}
            </h4>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {block.items.map((c) => {
              const tone = CARD_TONES[c.tone];
              const CIcon = (c.icon && CARD_ICONS[c.icon]) || Info;
              return (
                <div
                  key={c.label}
                  className="print-card rounded-xl border p-3.5"
                  style={{ backgroundColor: tone.bg, borderColor: tone.border }}
                >
                  <span
                    className="mb-1 flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: tone.ink }}
                  >
                    <CIcon className="h-4 w-4 shrink-0" style={{ color: tone.icon }} />
                    {c.label}
                  </span>
                  <p className="text-[13px] leading-relaxed text-black/65">{c.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "text": {
      if (block.variant === "dark") {
        return (
          <div className="print-card space-y-2 rounded-2xl bg-slate-900 p-5 text-xs text-slate-200">
            {block.title && (
              <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                <Newspaper className="h-4 w-4 shrink-0" />
                {block.title}
              </div>
            )}
            <p className="leading-relaxed text-slate-300">{block.body}</p>
          </div>
        );
      }

      if (block.variant === "alert") {
        return (
          <div
            className="print-card space-y-2 rounded-2xl border p-5"
            style={{ backgroundColor: CARD_TONES.rose.bg, borderColor: CARD_TONES.rose.border }}
          >
            {block.title && (
              <h4
                className="flex items-center justify-center gap-2 text-center text-2xl font-bold leading-tight md:text-3xl"
                style={{ color: CARD_TONES.rose.ink }}
              >
                <AlertTriangle
                  className="h-6 w-6 shrink-0"
                  style={{ color: CARD_TONES.rose.icon }}
                />
                {block.title}
                <AlertTriangle
                  className="h-6 w-6 shrink-0"
                  style={{ color: CARD_TONES.rose.icon }}
                />
              </h4>
            )}
            <div
              className="space-y-3 text-base leading-relaxed"
              style={{ color: CARD_TONES.rose.ink }}
            >
              {block.body
                .split(/\n+/)
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
          </div>
        );
      }

      if (block.variant === "highlight") {
        return (
          <div className="folklore-pattern print-card flex items-start gap-4 rounded-2xl p-5 text-white shadow-md">
            <span className="animated-icon-box flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-950">
              <Lightbulb className="h-6 w-6" />
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Интересен факт
              </span>
              {block.title && <h4 className="text-base font-bold text-white">{block.title}</h4>}
              <p className="mt-1 text-xs leading-relaxed text-village-100">{block.body}</p>
            </div>
          </div>
        );
      }

      return (
        <SubCard title={block.title} tone={block.tone}>
          <div className="space-y-3 text-base leading-relaxed text-slate-700">
            {block.body
              .split(/\n+/)
              .filter(Boolean)
              .map((para, i) => {
                const m = /^([^:\d][^:]{1,58}):\s+(.+)$/.exec(para);
                return (
                  <p key={i}>
                    {m ? (
                      <>
                        <strong className="font-bold text-slate-900">{m[1]}:</strong> {m[2]}
                      </>
                    ) : (
                      para
                    )}
                  </p>
                );
              })}
          </div>
        </SubCard>
      );
    }

    case "scale":
      return (
        <div>
          {block.title && (
            <h4
              className="mb-3 text-sm font-bold uppercase tracking-wide"
              style={{ color: accent }}
            >
              {block.title}
            </h4>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {block.items.map((s) => {
              const meta = SCALE_LEVELS[s.level];
              const tone = CARD_TONES[meta.tone];
              const percent = Math.max(0, Math.min(100, s.percent));
              return (
                <div
                  key={s.label}
                  className="print-card space-y-3 rounded-2xl border p-5"
                  style={{ backgroundColor: tone.bg, borderColor: tone.border }}
                >
                  <span
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: tone.ink, opacity: 0.75 }}
                  >
                    {s.label}
                    <SourceArrow sources={s.sources} />
                  </span>
                  <span className="block text-3xl font-bold" style={{ color: tone.ink }}>
                    {s.levelText}
                  </span>
                  <div className="h-2.5 w-full rounded-full bg-white/60">
                    <div
                      className={`h-2.5 rounded-full ${meta.bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {s.note && <p className="text-base leading-relaxed text-slate-700">{s.note}</p>}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "distances":
      return (
        <div className="print-card rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
          {block.title && (
            <h4 className="mb-4 text-center text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
              {block.title}
            </h4>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">До къде</th>
                  <th className="py-2 pr-3">Разстояние</th>
                  <th className="py-2 pr-3">С кола</th>
                  <th className="py-2 pr-3">С влак</th>
                  <th className="py-2">По какъв път</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-slate-800">
                      {r.to}
                      {r.info && <InfoTip text={r.info} label={r.to} />}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{r.distance}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.driveTime}</td>
                    <td
                      className="py-2 pr-3 font-bold"
                      style={r.hasTrain ? { color: accent } : undefined}
                    >
                      {r.hasTrain ? "Да" : "—"}
                    </td>
                    <td className="py-2 text-slate-700">{r.road || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "list":
      return (
        <SubCard title={block.title} tone={block.tone}>
          <ul className="space-y-2">
            {block.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-base leading-relaxed text-slate-700"
              >
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" style={{ color: accent }} />
                <ListItemText text={item} />
              </li>
            ))}
          </ul>
        </SubCard>
      );

    case "pie": {
      const palette = [accent, "#f59e0b", "#0ea5e9", "#94a3b8"];
      return (
        <div>
          <h4
            className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {block.title}
            <span
              title={
                block.note ||
                "Данните може да са приблизителни или на общинско ниво (Преброяване 2021 г., НСИ)."
              }
              aria-label="Пояснение към данните"
              className="inline-flex cursor-help items-center opacity-70 print:hidden"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          </h4>
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={block.data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {block.data.map((d, i) => (
                      <Cell key={d.name} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {block.data.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: palette[i % palette.length] }}
                  />
                  <span className="font-medium text-black/80">{d.name}</span>
                  <span className="ml-auto font-bold" style={{ color: ink }}>
                    {d.value}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {block.note && (
            <p
              className="mt-3 rounded-xl border border-dashed p-3 text-sm font-medium"
              style={{ borderColor: accent, color: ink }}
            >
              {block.note}
            </p>
          )}
        </div>
      );
    }

    case "bars": {
      return (
        <div>
          <h4
            className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {block.title}
            {block.unit && (
              <span className="text-xs font-normal normal-case opacity-70">({block.unit})</span>
            )}
          </h4>
          <div className="print-card rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
            <div className="pointer-events-none h-56 w-full select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={block.data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Bar
                    dataKey="value"
                    fill={accent}
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                    label={{ position: "top", fontSize: 12, fontWeight: 700, fill: "#334155" }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {block.note && <p className="mt-2 text-xs font-medium text-slate-500">{block.note}</p>}
          </div>
        </div>
      );
    }

    case "schedule":
      return (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
              {block.title}
            </h4>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="print:hidden">
                  Пълно разписание
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{block.title}</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Линия</th>
                        <th className="py-2 pr-3 font-semibold">Дни</th>
                        <th className="py-2 pr-3 font-semibold">Курсове</th>
                        <th className="py-2 font-semibold">Часови обхват</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((r, i) => (
                        <tr key={`${r.route}-modal-${i}`} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{r.route}</td>
                          <td className="py-2 pr-3">{r.days}</td>
                          <td className="py-2 pr-3">{r.runs}</td>
                          <td className="py-2">{r.last}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.note && <p className="text-sm italic text-muted-foreground">{block.note}</p>}
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-3">
            {block.rows.map((r, i) => (
              <div
                key={`${r.route}-${i}`}
                className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <Bus className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                  <span className="min-w-0 flex-1 font-semibold text-black/80 wrap-anywhere">
                    {r.route}
                  </span>
                  <span
                    className="ml-auto max-w-full shrink rounded-2xl px-2 py-0.5 text-xs font-bold leading-snug text-white wrap-anywhere"
                    style={{ backgroundColor: accent }}
                  >
                    {r.days}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-black/70">
                  <span>
                    Курсове: <b>{r.runs}</b>
                  </span>
                  <span>
                    Часови обхват: <b>{r.last}</b>
                  </span>
                </div>
              </div>
            ))}
          </div>
          {block.note && <p className="mt-3 text-sm italic text-black/55">{block.note}</p>}
        </div>
      );

    case "risks":
      return (
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
            {block.title}
          </h4>
          <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
            {block.items.map((r) => {
              const meta = RISK[r.level];
              const percent = Math.max(0, Math.min(100, r.percent ?? meta.percent));
              return (
                <div
                  key={r.label}
                  className="print-card space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 font-bold">
                    <span className="flex min-w-0 flex-1 items-start gap-1.5 text-slate-800 wrap-anywhere">
                      <AlertTriangle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: meta.color }}
                      />
                      <span>
                        {r.label}
                        <SourceArrow sources={r.sources} />
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${meta.pill}`}
                    >
                      {meta.label} риск ({percent}%)
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-2.5 rounded-full transition-all ${meta.bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {(r.note || typeof r.incidentCount === "number") && (
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {r.note}
                      {typeof r.incidentCount === "number" && (
                        <span className="ml-1 font-semibold text-slate-600">
                          Регистрирани: {r.incidentCount}.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "checklist":
      return (
        <div className="space-y-3">
          {block.items.map((group, gi) => (
            <div
              key={group.title}
              className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {gi + 1}
                </span>
                <span className="font-semibold text-black/80">{group.title}</span>
              </div>
              <ul className="mt-2 space-y-1.5 pl-8">
                {group.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-black/70">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
  }
}

/** „Етикет: текст“ — етикетът се показва с удебелен шрифт. */
function ListItemText({ text }: { text: string }) {
  const m = /^([^:\d][^:]{1,58}):\s+(.+)$/s.exec(text);
  if (!m) return <span>{text}</span>;
  return (
    <span>
      <span className="font-semibold text-slate-900">{m[1]}:</span> {m[2]}
    </span>
  );
}

const CHIP_STYLE = {
  good: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  fair: "bg-amber-50 text-amber-900 ring-amber-200",
  poor: "bg-rose-50 text-rose-900 ring-rose-200",
  none: "bg-slate-50 text-slate-700 ring-slate-200",
} as const;

function SummaryChips({ chips }: { chips: SummaryChip[] }) {
  if (chips.length === 0) return null;
  return (
    <span className="mt-2 flex flex-wrap gap-1.5 print:hidden">
      {chips.map((c, i) => (
        <span
          key={i}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${CHIP_STYLE[c.level ?? "none"]}`}
        >
          {c.text}
        </span>
      ))}
    </span>
  );
}

function Section({
  section,
  extra,
  purposeNote,
  open,
  onToggle,
}: {
  section: ReportSection;
  extra?: ReactNode;
  purposeNote?: string | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = THEMES[section.theme];
  const Icon = ICONS[section.id] ?? MapPin;
  const source =
    section.id === "onsite-checklist" ? section.blocks : checklistsToLists(section.blocks);
  let blocks =
    section.id === "basic"
      ? layoutBasicBlocks(source)
      : section.id === "ethnos"
        ? layoutEthnosBlocks(source)
        : section.id === "history"
          ? layoutHistoryBlocks(source)
          : source;
  if (!HAS_BESPOKE_LAYOUT.has(section.id)) blocks = sortBlocksBySize(blocks);

  // Финалната обобщена оценка получава тъмния „village“ стил от еталона.
  if (section.id === "perspective-summary") {
    return (
      <section className="wrap-anywhere print-card scroll-mt-6 space-y-4 rounded-3xl border border-village-600 bg-village-700 p-6 text-white shadow-2xl md:p-8">
        <div className="flex items-center gap-3">
          <span className="animated-icon-box flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-village-clay text-white shadow-lg">
            <Award className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-accent text-2xl font-bold text-white">
              Обобщена оценка от Къде Да
            </h3>
            <p className="text-xs text-village-200">Качествено заключение спрямо избраната цел</p>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-6 text-sm leading-relaxed backdrop-blur-md">
          {section.blocks.map((b, i) =>
            b.kind === "text" ? (
              <p key={i}>{b.body}</p>
            ) : b.kind === "list" ? (
              <ul key={i} className="space-y-1.5">
                {b.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-village-wheat" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            ) : null,
          )}
        </div>
      </section>
    );
  }

  const bodyId = `section-body-${section.id}`;
  const chips = summaryChips(section);

  const iconBox = (
    <span
      className={`animated-icon-box flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${theme.box}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
  const textBlock = (
    <span className="min-w-0 flex-1">
      <span className="block text-2xl font-bold leading-tight text-slate-900">{section.title}</span>
      {section.summary ? (
        <span className="mt-1 block text-sm font-normal leading-snug text-slate-600">
          {section.summary}
        </span>
      ) : (
        section.subtitle && (
          <span className="block text-xs font-normal text-slate-500">{section.subtitle}</span>
        )
      )}
      {!open && <SummaryChips chips={chips} />}
    </span>
  );
  const chevronClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 print:hidden";

  // Затворена категория се отваря с клик където и да е върху нея (освен върху картата);
  // отворената се затваря само със стрелката.
  const openOnClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-toggle]")) return;
    onToggle();
  };

  return (
    <section
      id={`section-${section.id}`}
      onClick={open ? undefined : openOnClick}
      className={`wrap-anywhere print-card scroll-mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg transition-shadow md:p-8 ${
        open ? "" : "cursor-pointer hover:shadow-xl"
      }`}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <h3 className="min-w-0 flex-1">
          {open ? (
            <span className="flex w-full items-start gap-3">
              {iconBox}
              {textBlock}
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={true}
                aria-controls={bodyId}
                aria-label={`Свий категорията „${section.title}“`}
                className={`${chevronClass} outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                <ChevronDown className="h-7 w-7 rotate-180 transition-transform duration-200" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-expanded={false}
              aria-controls={bodyId}
              className="group flex w-full items-start gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {iconBox}
              {textBlock}
              <span className={`${chevronClass} group-hover:bg-slate-200`} aria-hidden="true">
                <ChevronDown className="h-7 w-7 transition-transform duration-200" />
              </span>
            </button>
          )}
        </h3>
        {open && purposeNote && (
          <div
            className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/50 p-3 text-xs leading-relaxed text-slate-600 md:max-w-xs md:shrink-0 print:hidden"
            style={{ borderColor: theme.accent }}
          >
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: theme.accent }} />
            <span>{purposeNote}</span>
          </div>
        )}
      </header>

      {/* Картата на първата категория се вижда и когато категорията е свита. */}
      {extra && (
        <div className="mt-6" data-no-toggle>
          {extra}
        </div>
      )}

      {/* Съдържанието остава подредено в страницата и когато е свито (височина 0, невидимо), за да
          се оразмеряват графиките и картата; при печат винаги се показва. */}
      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out print:grid-rows-[1fr] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div
          className={`min-h-0 overflow-hidden print:visible print:overflow-visible ${
            open ? "" : "invisible"
          }`}
        >
          <div className="space-y-6 pt-6">
            <div className="space-y-6">
              {blocks.map((b, i) => (
                // Личната информация (разстояние от настоящата локация) не се печата и не излиза в PDF.
                <div key={i} className={isCurrentLocationBlock(b) ? "print:hidden" : undefined}>
                  <Block block={b} accent={theme.accent} ink={theme.ink} hover={theme.hover} />
                </div>
              ))}
            </div>

            <SectionFooter cachedAt={section.cachedAt} sources={section.sources} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Блок „От <настояща локация>“ — съдържа лична информация и не се печата. */
function isCurrentLocationBlock(b: ReportBlock): boolean {
  return (
    b.kind === "facts" &&
    (b.title ?? "").startsWith("От ") &&
    b.items.some((it) => it.label === "Разстояние по път")
  );
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("bg-BG");
}

/** Дата на данните и списък с източниците, на които се е опряло проучването. */
function SectionFooter({
  cachedAt,
  sources,
}: {
  cachedAt?: string | undefined;
  sources?: SourceLink[] | undefined;
}) {
  const date = formatDate(cachedAt);
  if (!date && (!sources || sources.length === 0)) return null;

  return (
    <footer className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
      {date && <p>Данни към {date}</p>}
      {sources && sources.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900 print:hidden">
            Източници ({sources.length})
          </summary>
          <ul className="mt-2 space-y-1 print:block">
            {sources.map((src) => (
              <li key={src.url} className="truncate">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline-offset-2 hover:underline"
                >
                  {src.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </footer>
  );
}

type InfographicProps = {
  place?: Settlement | null;
  current?: Settlement | null;
  sections?: ReportSection[];
  demo?: boolean;
  purpose?: PurposeId | null;
  /** Кога е генериран докладът (ISO) — показва се в заглавието. */
  generatedAt?: string | undefined;
};

/** Координати на с. Медово (ekatte 47665) — fallback за демо режима. */
const DEMO_MAP_POINT = { lat: 42.371968, lng: 25.201267, label: MOCK_REPORT_PLACE };
const DEMO_POSTAL_CODE = "6235";

export function ReportInfographic({
  place = null,
  current = null,
  sections = MOCK_REPORT,
  demo = true,
  purpose = null,
  generatedAt,
}: InfographicProps) {
  const { profile } = useAuth();
  const generatedDate = formatDate(generatedAt);
  // Стабилни референции — иначе LocationMap ре-тригва ефекта си на всеки render.
  const mapPoint = useMemo(
    () =>
      place && place.lat != null && place.lng != null
        ? { lat: place.lat, lng: place.lng, label: displaySettlement(place) }
        : DEMO_MAP_POINT,
    [place],
  );
  const currentPoint = useMemo(
    () =>
      place && current && current.lat != null && current.lng != null
        ? { lat: current.lat, lng: current.lng, label: displaySettlement(current) }
        : null,
    [place, current],
  );

  // Категориите са затворени при отваряне на доклада; отворените се помнят само докато страницата е отворена.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const collapsibleIds = sections.filter((x) => x.id !== "perspective-summary").map((x) => x.id);
  const allOpen = collapsibleIds.length > 0 && collapsibleIds.every((id) => openIds.has(id));
  const toggleSection = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const placeLabel = place ? displaySettlement(place) : MOCK_REPORT_PLACE;
  const postalCode = place?.postalCode || DEMO_POSTAL_CODE;

  return (
    <div className="report-canvas relative left-1/2 w-screen -translate-x-1/2 font-sans print:static print:left-auto print:w-full print:translate-x-0">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:py-8">
        <div className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3.5 md:px-7 md:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-flag-green text-base font-bold text-white shadow-sm">
                <MapPin className="h-5 w-5" />
              </span>
              <h2 className="wrap-anywhere font-accent text-2xl font-black tracking-wide text-slate-900 md:text-3xl">
                {placeLabel}
                {postalCode ? ` · п.к. ${postalCode}` : ""}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {generatedDate && (
                <span className="text-xs text-slate-500">Генериран на {generatedDate}</span>
              )}
              {isPremium(profile) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="print:hidden"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Печат / PDF
                </Button>
              )}
            </div>
          </div>
          <div className="h-3 w-full bg-flag-green" />
          <div className="h-3 w-full bg-flag-red" />
        </div>

        {collapsibleIds.length > 1 && (
          <div className="flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => setOpenIds(allOpen ? new Set() : new Set(collapsibleIds))}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {allOpen ? "Свий всички категории" : "Разгъни всички категории"}
            </button>
          </div>
        )}

        {sections.map((s) => (
          <Section
            key={s.id}
            open={openIds.has(s.id)}
            onToggle={() => toggleSection(s.id)}
            section={s}
            extra={
              s.id === "basic" && mapPoint ? (
                <div className={currentPoint ? "print:hidden" : undefined}>
                  <LocationMap place={mapPoint} current={currentPoint} />
                </div>
              ) : undefined
            }
            purposeNote={purpose ? PURPOSE_INSIGHTS[purpose]?.[s.id] : undefined}
          />
        ))}
      </div>
    </div>
  );
}
