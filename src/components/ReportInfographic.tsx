import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bus,
  ClipboardCheck,
  Droplet,
  Factory,
  Landmark,
  MapPin,
  MessageCircle,
  Newspaper,
  Shield,
  TreePine,
  Users,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  MOCK_REPORT,
  MOCK_REPORT_PLACE,
  type ReportBlock,
  type ReportSection,
  type RiskLevel,
  type SourceLink,
} from "@/data/mock-report";
import "leaflet/dist/leaflet.css";

import { LocationMap } from "@/components/LocationMap";
import type { Settlement } from "@/lib/settlements";
import { displaySettlement } from "@/lib/settlements";

const ICONS: Record<string, LucideIcon> = {
  basic: MapPin,
  vik: Droplet,
  ethnos: Users,
  transport: Bus,
  power: Zap,
  security: Shield,
  services: Landmark,
  connectivity: Wifi,
  industry: Factory,
  social: Newspaper,
  news: Landmark,
  media: MessageCircle,
  risks: TreePine,
  environment: AlertTriangle,
  "onsite-checklist": ClipboardCheck,
};

type Theme = ReportSection["theme"];

const THEMES: Record<Theme, { accent: string; soft: string; ink: string }> = {
  emerald: { accent: "#059669", soft: "#ecfdf5", ink: "#064e3b" },
  sky: { accent: "#0284c7", soft: "#f0f9ff", ink: "#0c4a6e" },
  amber: { accent: "#d97706", soft: "#fffbeb", ink: "#78350f" },
  violet: { accent: "#7c3aed", soft: "#f5f3ff", ink: "#3b0764" },
  rose: { accent: "#e11d48", soft: "#fff1f2", ink: "#881337" },
  teal: { accent: "#0d9488", soft: "#f0fdfa", ink: "#134e4a" },
  indigo: { accent: "#4f46e5", soft: "#eef2ff", ink: "#312e81" },
  orange: { accent: "#ea580c", soft: "#fff7ed", ink: "#7c2d12" },
  lime: { accent: "#65a30d", soft: "#f7fee7", ink: "#365314" },
  cyan: { accent: "#0891b2", soft: "#ecfeff", ink: "#164e63" },
  fuchsia: { accent: "#c026d3", soft: "#fdf4ff", ink: "#701a75" },
  slate: { accent: "#475569", soft: "#f8fafc", ink: "#0f172a" },
};

const RISK: Record<RiskLevel, { label: string; color: string; width: string }> = {
  low: { label: "НИСЪК", color: "#16a34a", width: "33%" },
  medium: { label: "СРЕДЕН", color: "#d97706", width: "66%" },
  high: { label: "ВИСОК", color: "#dc2626", width: "100%" },
};

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

function Block({ block, accent, ink }: { block: ReportBlock; accent: string; ink: string }) {
  switch (block.kind) {
    case "facts":
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {block.items.map((f) => (
            <div
              key={f.label}
              className="rounded-2xl bg-white/70 p-3 text-center shadow-sm ring-1 ring-black/5"
            >
              <div className="text-xs uppercase tracking-wide text-black/50">{f.label}</div>
              <div className="mt-1 text-sm font-bold" style={{ color: ink }}>
                {f.value}
                <SourceArrow sources={f.sources} />
              </div>
            </div>
          ))}
        </div>
      );

    case "text":
      return (
        <div>
          {block.title && (
            <h4 className="mb-1 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
              {block.title}
            </h4>
          )}
          <p className="text-[15px] leading-relaxed text-black/75">{block.body}</p>
        </div>
      );

    case "list":
      return (
        <div>
          {block.title && (
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
              {block.title}
            </h4>
          )}
          <ul className="space-y-2">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2 text-[15px] leading-relaxed text-black/75">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
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
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
            {block.title}
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
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
            {block.title}
          </h4>
          <div className="space-y-3">
            {block.rows.map((r, i) => (
              <div
                key={`${r.route}-${i}`}
                className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Bus className="h-4 w-4" style={{ color: accent }} />
                  <span className="font-semibold text-black/80">{r.route}</span>
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white"
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
          <div className="space-y-3">
            {block.items.map((r) => {
              const meta = RISK[r.level];
              return (
                <div key={r.label} className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black/80">
                      {r.label}
                      <SourceArrow sources={r.sources} />
                    </span>
                    {typeof r.incidentCount === "number" && (
                      <span
                        className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-black/60"
                        title="Брой регистрирани рискови събития"
                      >
                        {r.incidentCount} събития
                      </span>
                    )}
                    <span
                      className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-black/10">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: meta.width, backgroundColor: meta.color }}
                    />
                  </div>
                  {r.note && <p className="mt-2 text-sm text-black/65">{r.note}</p>}
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

  return (
    <section
      className="wrap-anywhere scroll-mt-6 rounded-[2rem] p-6 shadow-sm ring-1 ring-black/5 sm:p-8"
      style={{ backgroundColor: theme.soft }}
    >
      <header className="flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow"
          style={{ backgroundColor: theme.accent }}
        >
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-2xl font-bold leading-tight" style={{ color: theme.ink }}>
            {section.title}
          </h3>
          {section.subtitle && (
            <p className="text-sm text-black/55">{section.subtitle}</p>
          )}
        </div>
      </header>

      <div className="mt-6 space-y-6">
        {extra}
        {section.blocks.map((b, i) => (
          <Block key={i} block={b} accent={theme.accent} ink={theme.ink} />
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
};

/** Координати на с. Медово (ekatte 47665) — fallback за демо режима. */
const DEMO_MAP_POINT = { lat: 42.371968, lng: 25.201267, label: MOCK_REPORT_PLACE };

export function ReportInfographic({
  place = null,
  current = null,
  sections = MOCK_REPORT,
  demo = true,
}: InfographicProps) {
  const mapPoint =
    place && place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng, label: displaySettlement(place) }
      : DEMO_MAP_POINT;
  const currentPoint =
    place && current && current.lat != null && current.lng != null
      ? { lat: current.lat, lng: current.lng, label: displaySettlement(current) }
      : null;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-dashed border-border bg-background/80 p-5 text-center">
        {demo && (
          <p className="text-xs font-bold uppercase tracking-widest text-destructive">
            Демонстрационни данни
          </p>
        )}
        <h2 className="mt-1 text-2xl font-bold text-primary">
          {place ? displaySettlement(place) : MOCK_REPORT_PLACE}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {demo
            ? "Примерен доклад за визуализация на резултата. Данните са мостра — все още не се генерират автоматично."
            : "Докладът е генериран автоматично от Gemini с търсене в Google в реално време. Проверявайте важните факти по посочените източници."}
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

