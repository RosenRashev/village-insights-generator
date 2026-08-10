import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, House, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { buildPrompt } from "@/lib/build-prompt";
import { PROMPT_MODULES, type PlaceType } from "@/lib/prompt-modules";
import { SettlementCombobox } from "@/components/SettlementCombobox";
import { ModuleCard } from "@/components/ModuleCard";
import { TopoBackground } from "@/components/TopoBackground";
import { FeedbackBox } from "@/components/FeedbackBox";

import { formatSettlement, type Settlement } from "@/lib/settlements";


const TITLE = "Да се върнем на село — генератор на промпти за проучване";
const DESCRIPTION =
  "Съставете готов промпт за задълбочено проучване на село, малък град или квартал: инфраструктура, ВиК, транспорт, сигурност, новини. Копирайте и поставете в любимия си AI чат.";

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

function GeminiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0c.4 6.3 5.7 11.6 12 12-6.3.4-11.6 5.7-12 12-.4-6.3-5.7-11.6-12-12C6.3 11.6 11.6 6.3 12 0z" />
    </svg>
  );
}

function Index() {
  const [place, setPlace] = useState<Settlement | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Settlement | null>(null);
  const placeType: PlaceType = place?.isVillage ? "village" : "town";
  const [selected, setSelected] = useState<string[]>(() =>
    PROMPT_MODULES.map((m) => m.id),
  );
  const [copied, setCopied] = useState(false);
  const [copiedOnly, setCopiedOnly] = useState(false);

  const hasPlace = place !== null;
  const prompt = useMemo(
    () =>
      buildPrompt({
        place: place ? formatSettlement(place) : "",
        placeType,
        selected,
        currentLocation: currentLocation ? formatSettlement(currentLocation) : "",
      }),
    [place, placeType, selected, currentLocation],
  );



  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const showCopiedToast = () =>
    toast.success("ПРОМПТЪТ Е КОПИРАН В ПАМЕТТА — ГОТОВ ЗА ПОСТАВЯНЕ (Ctrl+V)", {
      duration: 5000,
      className: "text-base font-bold py-6",
    });

  const copyOnly = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      toast.error("Копирането не успя — опитайте отново");
      return;
    }
    setCopiedOnly(true);
    setTimeout(() => setCopiedOnly(false), 2500);
    showCopiedToast();
  };

  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      toast.error("Копирането не успя — опитайте отново");
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    showCopiedToast();

    let opened: Window | null = null;
    try {
      opened = window.open(
        "https://gemini.google.com/app",
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      opened = null;
    }

    if (!opened) {
      toast(
        "Браузърът блокира автоматичното отваряне — отворете gemini.google.com ръчно и поставете с Ctrl+V.",
        { duration: 5000 },
      );
    }
  };



  const reset = () => {
    setPlace(null);
    setCurrentLocation(null);
    setSelected(PROMPT_MODULES.map((m) => m.id));
  };


  return (
    <main className="relative min-h-screen bg-background/80">
      <TopoBackground />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">

        <header className="border-b border-border pb-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl [text-shadow:0_2px_6px_hsl(0_0%_0%/0.35)]">
            <span className="text-background [-webkit-text-stroke:1px_hsl(0_0%_45%)]">
              СЕЛО
            </span>
            <span className="text-primary">СКО</span>
            <span className="text-destructive">П</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            За приложението: Ролята на този инструмент е да генерира прецизно
            структурирана инструкция, която да насочи изкуствения интелект да търси
            точно определени факти, вместо да генерира общи или измислени отговори.
            Проектът е с нестопанска цел, създаден е в подкрепа на купувачите на
            имоти и в момента се намира в процес на активна разработка.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-center text-2xl font-bold text-primary sm:text-3xl">
            Кое населено място проучвате?
          </h2>
          <div className="mt-4 space-y-4">
            <SettlementCombobox
              id="place"
              label="Населено място или пощенски код"
              placeholder="напр. Баня или 4360"
              value={place}
              onChange={setPlace}
            />




            {hasPlace && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SettlementCombobox
                  id="current-location"
                  label="Настояща локация"
                  placeholder="напр. Стара Загора"
                  value={currentLocation}
                  onChange={setCurrentLocation}
                  size="sm"
                />
                <p className="text-sm text-muted-foreground">
                  Въведете населеното място, в което живеете в момента, за да
                  изчислим разстоянието, времето за пътуване и транспортната
                  достъпност за имоти купувани с цел уикенд туризъм за отдих и
                  почивка.
                </p>
              </div>
            )}
          </div>

        </section>



        {hasPlace && (
          <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-bold text-destructive">
              Какво да включим в проучването?
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROMPT_MODULES.map((m) => (
                <ModuleCard
                  key={m.id}
                  module={m}
                  selected={selected.includes(m.id)}
                  onToggle={() => toggle(m.id)}
                />
              ))}
            </div>
          </section>
        )}

        {hasPlace && selected.length > 0 && (
          <section className="mt-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-4 text-center">
              <p className="text-lg font-bold text-foreground">
                Как да извлечете максимална полза от генерирания промпт?
              </p>
              <div className="space-y-3 text-sm text-muted-foreground whitespace-pre-line">
                <p>Препоръчваме да използвате промпта в Google Gemini.</p>
                <p>
                  Защо Gemini? За разлика от много други модели, Gemini разполага с пряк и ефективен достъп до търсачката на Google в реално време. Това му позволява да намира най-актуалните новини, общински съобщения, графици и официални данни за избраното населено място.
                </p>
                <p>
                  Безплатен достъп: Не е необходим платен абонамент — безплатната версия на Gemini е напълно достатъчна за изготвянето на детайлен доклад.
                </p>
              </div>
            </div>
            <ol className="w-full max-w-md space-y-3 text-left text-base text-foreground">
              {[
                "Натисни бутона — промптът се копира автоматично",
                "Ще бъдеш пренасочен към Gemini",
                "Натисни Ctrl+V, за да поставиш промпта в полето",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-1 leading-snug">{step}</span>
                </li>
              ))}
            </ol>

            <Accordion
              type="single"
              collapsible
              className="w-full max-w-md rounded-md border border-border bg-muted/50 px-3"
            >
              <AccordionItem value="gemini-account" className="border-none">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  <span className="flex items-center gap-2 text-left">
                    <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Нямате Gemini акаунт? Прочетете тук
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3 text-sm text-muted-foreground">
                  Не е необходимо да инсталирате нищо. Трябва Ви само обикновен
                  Google акаунт (същият, който ползвате за Gmail). При първото
                  отваряне на gemini.google.com системата ще Ви поиска да влезете
                  с него и да разрешите на Gemini достъп до профила Ви — това е
                  стандартна стъпка на Google и отнема секунди. Услугата е
                  напълно безплатна.
                </AccordionContent>
              </AccordionItem>
            </Accordion>



            <button
              type="button"
              onClick={copyAndOpen}
              aria-label="Копирай промпта и отвори Gemini"
              className="group flex h-40 w-40 flex-col items-center justify-center gap-1.5 bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 [clip-path:polygon(50%_0%,100%_38%,100%_100%,0%_100%,0%_38%)]"
            >
              {copied ? (
                <Check className="mt-7 h-11 w-11" />
              ) : (
                <span className="mt-7 flex items-center gap-1.5">
                  <House className="h-11 w-11" />
                  <GeminiMark className="h-6 w-6" />
                </span>
              )}
              <span className="px-3 text-center text-[15px] font-semibold leading-tight">
                {copied ? "✓ Копирано!" : "Копирай и отвори Gemini"}
              </span>
            </button>

            <span
              key={selected.length}
              className="animate-in zoom-in-95 fade-in rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-transform duration-200 ease-out"
            >
              {selected.length} избрани
            </span>



            <button
              type="button"
              onClick={copyOnly}
              className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {copiedOnly ? "✓ Копирано!" : "Само копирай"}
            </button>

            <p className="text-xs text-muted-foreground">
              Ако Gemini не се отвори тук, отворете{" "}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                gemini.google.com
              </a>{" "}
              в нов таб и поставете с Ctrl+V (Cmd+V).
            </p>

            <Button onClick={reset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" />
              Изчисти
            </Button>
          </section>
        )}

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          Проектът е с нестопанска цел, в подкрепа на купувачите на имоти, в процес на активна разработка.
          <FeedbackBox />
        </footer>

      </div>
    </main>
  );
}
