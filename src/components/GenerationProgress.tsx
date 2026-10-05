import { Loader2 } from "lucide-react";

type Props = { done: number; total: number; updating?: boolean };

/** Голямо зелено поле с брояч, което показва как докладът се попълва поетапно. */
export function GenerationProgress({ done, total, updating = false }: Props) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full max-w-md rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-lg"
    >
      <div className="flex items-center justify-center gap-2 text-sm font-medium opacity-90">
        <Loader2 className="h-4 w-4 animate-spin" />
        {updating ? "Докладът се обновява…" : "Докладът се генерира…"}
      </div>
      <div className="mt-2 flex items-baseline justify-center gap-2">
        <span className="text-5xl font-extrabold tabular-nums sm:text-6xl">{done}</span>
        <span className="text-xl font-semibold opacity-80">от {total}</span>
      </div>
      <p className="mt-1 text-center text-sm opacity-90">готови категории</p>
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/25"
        aria-label={`${percent}% готово`}
      >
        <div
          className="h-full rounded-full bg-white transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
