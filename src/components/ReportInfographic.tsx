import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
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
  RefreshCw,
  Route,
  ShieldHalf,
  Stethoscope,
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
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { REPORT_DATA_SOURCE } from "@/lib/report-mode";
import type { Settlement } from "@/lib/settlements";
import { displaySettlement } from "@/lib/settlements";


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
    percent: 80,
    bar: "bg-rose-500",
    pill: "bg-rose-100 text-rose-700",
  },
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
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {block.items.map((f) => (
            <div
              key={f.label}
              className={`print-card flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 transition md:p-5 ${hover}`}
            >
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {f.label}
                </span>
                <span className="block text-base font-bold text-slate-800">
                  {f.value}
                  <SourceArrow sources={f.sources} />
                </span>
                {f.description && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {f.description}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
                <span className="text-[11px] font-medium text-slate-400">
                  {f.pillLabel ?? f.label}
                </span>
                <span
                  className="rounded-md px-2.5 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: `${accent}1a`, color: ink }}
                >
                  {f.pillValue ?? f.value}
                </span>
              </div>
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
          <div className="print-card rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
            <div className="relative mx-auto h-44 w-full max-w-xs">
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
                <dir.Icon className="mb-1 h-8 w-8" style={{ color: dir.color }} />
                <span className="text-2xl font-black text-black/80">
                  {block.direction === "down" ? "-" : block.direction === "up" ? "+" : ""}
                  {value}%
                </span>
                {block.periodLabel && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-black/40">
                    {block.periodLabel}
                  </span>
                )}
              </div>
            </div>
            {block.note && (
              <p className="mt-2 text-center text-[12px] text-black/55">{block.note}</p>
            )}
          </div>
        </div>
      );
    }

    case "cards":
      return (
        <div>
          {block.title && (
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
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
        <div className="print-card rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
          {block.title && (
            <h4 className="mb-1 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
              {block.title}
            </h4>
          )}
          <p className="text-sm leading-relaxed text-slate-600">{block.body}</p>
        </div>
      );
    }

    case "list":
      return (
        <div className="print-card rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
          {block.title && (
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
              {block.title}
            </h4>
          )}
          <ul className="space-y-2">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
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
              className="inline-flex cursor-help items-center opacity-70"
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
            <p className="mt-3 rounded-xl border border-dashed p-3 text-sm font-medium"
               style={{ borderColor: accent, color: ink }}>
              {block.note}
            </p>
          )}
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
                {block.note && (
                  <p className="text-sm italic text-muted-foreground">{block.note}</p>
                )}
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
                  <span className="min-w-0 flex-1 font-semibold text-black/80 wrap-anywhere">{r.route}</span>
                  <span
                    className="ml-auto max-w-full shrink rounded-2xl px-2 py-0.5 text-xs font-bold leading-snug text-white wrap-anywhere"
                    style={{ backgroundColor: accent }}
                  >
                    {r.days}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-black/70">
                  <span>Курсове: <b>{r.runs}</b></span>
                  <span>Часови обхват: <b>{r.last}</b></span>
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
            <div key={group.title} className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5">
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
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
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

function Section({
  section,
  extra,
}: {
  section: ReportSection;
  extra?: ReactNode;
}) {
  const theme = THEMES[section.theme];
  const Icon = ICONS[section.id] ?? MapPin;

  // Финалната обобщена оценка получава тъмния „village“ стил от еталона.
  if (section.id === "perspective-summary") {
    return (
      <section className="wrap-anywhere print-card scroll-mt-6 space-y-4 rounded-3xl border border-village-600 bg-village-700 p-6 text-white shadow-2xl md:p-8">
        <div className="flex items-center gap-3">
          <span className="animated-icon-box flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-village-clay text-white shadow-lg">
            <Award className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-accent text-2xl font-bold text-white">{section.title}</h3>
            {section.subtitle && <p className="text-xs text-village-200">{section.subtitle}</p>}
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

  return (
    <section className="wrap-anywhere print-card scroll-mt-6 space-y-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg md:p-8">
      <header className="flex items-center gap-3">
        <span
          className={`animated-icon-box flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${theme.box}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-2xl font-bold leading-tight text-slate-900">{section.title}</h3>
          {section.subtitle && <p className="text-xs text-slate-500">{section.subtitle}</p>}
        </div>
      </header>

      <div className="space-y-6">
        {extra}
        {section.blocks.map((b, i) => (
          <Block key={i} block={b} accent={theme.accent} ink={theme.ink} hover={theme.hover} />
        ))}
      </div>
    </section>
  );
}


type InfographicProps = {
  place?: Settlement | null;
  current?: Settlement | null;
  sections?: ReportSection[];
  demo?: boolean;
  /** Показва бутон „Регенерирай примерни данни“ (само в mock режим). */
  onRegenerate?: (() => void) | undefined;
};

/** Координати на с. Медово (ekatte 47665) — fallback за демо режима. */
const DEMO_MAP_POINT = { lat: 42.371968, lng: 25.201267, label: MOCK_REPORT_PLACE };
const DEMO_POSTAL_CODE = "6235";

export function ReportInfographic({
  place = null,
  current = null,
  sections = MOCK_REPORT,
  demo = true,
  onRegenerate,
}: InfographicProps) {
  const mapPoint =
    place && place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng, label: displaySettlement(place) }
      : DEMO_MAP_POINT;
  const currentPoint =
    place && current && current.lat != null && current.lng != null
      ? { lat: current.lat, lng: current.lng, label: displaySettlement(current) }
      : null;

  const placeLabel = place ? displaySettlement(place) : MOCK_REPORT_PLACE;
  const postalCode = place?.postalCode || DEMO_POSTAL_CODE;

  return (
    <div className="space-y-6 font-sans">
      {/* Sticky лента с действия */}
      <div className="sticky top-0 z-30 -mx-2 rounded-2xl bg-village-700 px-4 py-2.5 text-white shadow-lg print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-village-clay">
              <TreePine className="h-4 w-4" />
            </span>
            <span className="font-accent text-lg font-black tracking-wide">СЕЛОСКОП</span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-village-200">
              {demo ? "Демо доклад" : "Пълен доклад"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {REPORT_DATA_SOURCE === "mock" && onRegenerate && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={onRegenerate}
              >
                <RefreshCw className="h-4 w-4" />
                Регенерирай
              </Button>
            )}
            <Button
              size="sm"
              className="bg-village-clay text-white hover:bg-village-clay/90"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Печат / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Флаг-банер със заглавие на населеното място */}
      <div className="print-card overflow-hidden rounded-2xl border border-border bg-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-flag-green text-white">
              <MapPin className="h-5 w-5" />
            </span>
            <h2 className="wrap-anywhere font-accent text-2xl font-black tracking-wide text-slate-900 md:text-3xl">
              {placeLabel}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 px-4 py-1.5">
            <span className="text-xs font-bold uppercase text-slate-600">Пощенски код:</span>
            <span className="text-lg font-black text-slate-900">{postalCode}</span>
          </div>
        </div>
        <div className="h-3 w-full bg-flag-green" />
        <div className="h-3 w-full bg-flag-red" />
      </div>


      <div className="rounded-[2rem] border border-dashed border-border bg-background/80 p-5 text-center print:hidden">
        {demo && (
          <p className="text-xs font-bold uppercase tracking-widest text-destructive">
            Демонстрационни данни
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {demo
            ? "Примерен доклад за визуализация на резултата. Данните са мостра — все още не се генерират автоматично."
            : "Докладът е генериран автоматично с търсене в реално време. Проверявайте важните факти по посочените източници."}
        </p>
      </div>

      {sections.map((s) => (
        <Section
          key={s.id}
          section={s}
          extra={
            s.id === "basic" && mapPoint ? (
              <LocationMap place={mapPoint} current={currentPoint} />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}


