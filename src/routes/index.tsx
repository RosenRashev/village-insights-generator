import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Copy, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildPrompt } from "@/lib/build-prompt";
import { PLACE_TYPES, PROMPT_MODULES, type PlaceType } from "@/lib/prompt-modules";

const TITLE = "Да се върнем на село — генератор на промпти за проучване";
const DESCRIPTION =
  "Съставете готов промпт за задълбочено проучване на село, малък град или квартал: ВиК, етнически състав, местни новини. Копирайте и поставете в любимия си AI чат.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [place, setPlace] = useState("");
  const [placeType, setPlaceType] = useState<PlaceType>("village");
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const hasPlace = place.trim().length > 1;
  const prompt = useMemo(
    () => buildPrompt({ place, placeType, selected }),
    [place, placeType, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Промптът е копиран");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Копирането не успя — маркирайте текста ръчно");
    }
  };

  const reset = () => {
    setPlace("");
    setPlaceType("village");
    setSelected([]);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <header className="border-b border-border pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Генератор на промпти
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-destructive sm:text-5xl">
              Да се върнем на село
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Отговорете на няколко въпроса и получете готов промпт, с който да проучите
              инфраструктурата и средата на дадено населено място, преди да купите имот
              там.
            </p>
          </header>

          <section className="mt-10">
            <StepTitle n={1} title="Кое населено място проучвате?" />
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="place" className="text-sm font-medium">
                  Населено място или пощенски код
                </Label>
                <Input
                  id="place"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="напр. с. Баня, обл. Пловдив или 4360"
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Тип на обекта</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PLACE_TYPES.map((t) => {
                    const active = placeType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setPlaceType(t.value)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span
                          className={`block text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}
                        >
                          {t.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {hasPlace && (
            <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <StepTitle n={2} title="Какво да включим в проучването?" />
              <div className="mt-4 space-y-3">
                {PROMPT_MODULES.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-4"
                  >
                    <Checkbox
                      id={m.id}
                      checked={selected.includes(m.id)}
                      onCheckedChange={() => toggle(m.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={m.id}
                          className="cursor-pointer text-sm font-semibold"
                        >
                          {m.label}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Какво добавя „${m.label}“`}
                              className="text-muted-foreground transition-colors hover:text-primary"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{m.info}</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{m.info}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasPlace && selected.length > 0 && (
            <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <StepTitle n={3} title="Вашият промпт" />
              <p className="mt-2 text-sm text-muted-foreground">
                Избрани раздела: {selected.length}. Копирайте текста и го поставете в AI
                чат с достъп до интернет.
              </p>
              <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-foreground">
                {prompt}
              </pre>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={copy} size="lg">
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Копирано" : "Копирай промпта"}
                </Button>
                <Button onClick={reset} variant="outline" size="lg">
                  <RotateCcw className="h-4 w-4" />
                  Изчисти
                </Button>
              </div>
            </section>
          )}

          <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
            Приложението не изпраща данни никъде — промптът се сглобява във вашия браузър.
          </footer>
        </div>
      </main>
    </TooltipProvider>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <h2 className="text-lg font-bold text-destructive">{title}</h2>
    </div>
  );
}
