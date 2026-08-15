import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, House, Info, Loader2, RotateCcw, Sparkles } from "lucide-react";
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
import { ReportInfographic } from "@/components/ReportInfographic";
import { getCategory } from "@/lib/report-cache.functions";
import type { ReportSection } from "@/data/mock-report";
import { ONSITE_CHECKLIST_SECTION } from "@/data/onsite-checklist";


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
  const [bouncing, setBouncing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [placeNotice, setPlaceNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [realSections, setRealSections] = useState<ReportSection[] | null>(null);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    setAccessCode(localStorage.getItem("seloskop-access-code") ?? "");
  }, []);


  const [currentNotice, setCurrentNotice] = useState<string | null>(null);

  const CONFLICT_MSG =
    "Настоящата локация не може да съвпада с търсеното населено място — полето беше изчистено.";

  const handlePlaceChange = (s: Settlement | null) => {
    setPlace(s);
    setPlaceNotice(null);
    if (s && currentLocation && currentLocation.ekatte === s.ekatte) {
      setCurrentLocation(null);
      setCurrentNotice(CONFLICT_MSG);
    } else {
      setCurrentNotice(null);
    }
  };

  const handleCurrentLocationChange = (s: Settlement | null) => {
    if (s && place && place.ekatte === s.ekatte) {
      setCurrentLocation(null);
      setCurrentNotice(CONFLICT_MSG);
      return;
    }
    setCurrentLocation(s);
    setCurrentNotice(null);
  };

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



  const toggle = (id: string) => {
    if (PROMPT_MODULES.find((m) => m.id === id)?.required) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

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
    setBouncing(true);
    setTimeout(() => setBouncing(false), 400);
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



  const generateReal = async () => {
    if (!place || selected.length === 0) return;
    const code = accessCode.trim();
    if (!code) {
      toast.error("Въведете код за достъп (затворен тест).");
      return;
    }
    localStorage.setItem("seloskop-access-code", code);
    setGenerating(true);
    setRealSections(null);
    setProgress({ done: 0, total: selected.length });
    const collected: ReportSection[] = [];
    let failed = 0;

    for (const categoryId of selected) {
      // Чек-листът е статичен — не се генерира от AI и не се кешира.
      if (categoryId === "onsite-checklist") {
        collected.push(ONSITE_CHECKLIST_SECTION);
        setRealSections([...collected]);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        continue;
      }
      try {
        const res = await getCategory({
          data: {
            ekatte: place.ekatte,
            categoryId,
            placeName: formatSettlement(place),
            placeType,
            accessCode: code,
            ...(currentLocation ? { currentLocationName: formatSettlement(currentLocation) } : {}),
          },
        });

        const section = res.data as unknown as ReportSection | null;
        if (section && Array.isArray(section.blocks)) {
          collected.push({ ...section, id: categoryId });
          setRealSections([...collected]);
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        toast.error(
          `Грешка при „${PROMPT_MODULES.find((m) => m.id === categoryId)?.label ?? categoryId}“: ${
            err instanceof Error ? err.message : "неизвестна грешка"
          }`,
        );
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setGenerating(false);
    if (collected.length === 0) {
      toast.error("Докладът не можа да бъде генериран.");
    } else if (failed > 0) {
      toast.warning(`Готово с ${failed} пропуснати категории.`);
    } else {
      toast.success("Докладът е готов.");
    }
  };

  const reset = () => {
    setPlace(null);
    setCurrentLocation(null);
    setSelected(PROMPT_MODULES.map((m) => m.id));
    setRealSections(null);
    setProgress({ done: 0, total: 0 });
  };


  return (
    <main className="relative min-h-screen bg-background/80">
      <TopoBackground />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">

        <header className="mount-rise border-b border-border pb-8 text-center">
          <h1 className="text-6xl font-bold tracking-tight text-center sm:text-7xl [text-shadow:0_2px_6px_hsl(0_0%_0%/0.35)]">
            <span className="title-part title-part-1 text-background [-webkit-text-stroke:1px_hsl(0_0%_45%)]">
              СЕЛО
            </span>
            <span className="title-part title-part-2 text-primary">СКО</span>
            <span className="title-part title-part-3 text-destructive">П</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            За приложението: Ролята на този инструмент е да генерира прецизно
            структурирана инструкция, която да насочи изкуствения интелект да търси
            точно определени факти, вместо да генерира общи или измислени отговори.
            Проектът е с нестопанска цел, създаден е в подкрепа на купувачите на
            имоти и в момента се намира в процес на активна разработка.
          </p>
        </header>

        <section className="mount-rise-delay mt-10">
          <h2 className="text-center text-2xl font-bold text-primary sm:text-3xl">
            Кое населено място проучвате?
          </h2>
          <div className="mt-4 space-y-4">
            <SettlementCombobox
              id="place"
              label="Населено място или пощенски код"
              placeholder="напр. Баня или 4360"
              value={place}
              onChange={handlePlaceChange}
              excludeLargeCities
              notice={placeNotice}
            />




            {hasPlace && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SettlementCombobox
                  id="current-location"
                  label="Настояща локация"
                  placeholder="напр. Стара Загора"
                  value={currentLocation}
                  onChange={handleCurrentLocationChange}
                  size="sm"
                  notice={currentNotice}
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
              className={`group flex h-40 w-40 flex-col items-center justify-center gap-1.5 bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 [clip-path:polygon(50%_0%,100%_38%,100%_100%,0%_100%,0%_38%)] ${bouncing ? "bounce-click" : ""}`}
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

        {hasPlace && selected.length > 0 && (
          <section className="mt-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="text-lg font-bold text-destructive">
                Генерирай истински доклад
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Приложението ще проучи избраните категории с Gemini и търсене в Google в
                реално време и ще покаже резултата тук като инфографика.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Затворен тест: генерирането изисква код за достъп.
              </p>
              <Input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Код за достъп"
                aria-label="Код за достъп"
                className="max-w-xs text-center"
              />
              <Button size="lg" onClick={generateReal} disabled={generating || !accessCode.trim()}>

                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating
                  ? `Генериране… ${progress.done}/${progress.total}`
                  : "Генерирай истински доклад"}
              </Button>
            </div>

            {(generating || realSections) && (
              <div className="mt-8 space-y-6">
                {realSections && realSections.length > 0 && (
                  <ReportInfographic
                    place={place}
                    current={currentLocation}
                    sections={realSections}
                    demo={false}
                  />
                )}
                {generating &&
                  Array.from({ length: Math.max(0, progress.total - progress.done) })
                    .slice(0, 3)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse space-y-4 rounded-[2rem] bg-muted/60 p-6 sm:p-8"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 shrink-0 rounded-2xl bg-muted-foreground/20" />
                          <div className="h-6 w-2/3 rounded bg-muted-foreground/20" />
                        </div>
                        <div className="h-4 w-full rounded bg-muted-foreground/15" />
                        <div className="h-4 w-5/6 rounded bg-muted-foreground/15" />
                        <div className="h-24 w-full rounded-2xl bg-muted-foreground/10" />
                      </div>
                    ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-16">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-lg font-bold text-destructive">
              Резултатът като инфографика (демо)
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Вижте как ще изглежда готовият доклад — цветни секции, диаграми и
              индикатори за риск. Засега с примерни данни.
            </p>
            <Button
              variant={showReport ? "outline" : "default"}
              onClick={() => setShowReport((v) => !v)}
            >
              {showReport ? "Скрий примерния доклад" : "Виж примерния доклад"}
            </Button>
          </div>
          {showReport && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ReportInfographic place={place} current={currentLocation} />
            </div>
          )}
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          Проектът е с нестопанска цел, в подкрепа на купувачите на имоти, в процес на активна разработка.
          <FeedbackBox />
        </footer>


      </div>
    </main>
  );
}
