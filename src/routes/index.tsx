import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import {
  PROMPT_MODULES,
  PURPOSE_OPTIONS,
  type PlaceType,
  type PurposeId,
} from "@/lib/prompt-modules";
import { REPORT_DATA_SOURCE } from "@/lib/report-mode";
import {
  generateMockCategory,
  generateMockPerspectiveSummary,
} from "@/lib/mock-report-generator";
import { SettlementCombobox } from "@/components/SettlementCombobox";
import { ModuleCard } from "@/components/ModuleCard";
import { TopoBackground } from "@/components/TopoBackground";
import { FeedbackBox } from "@/components/FeedbackBox";
import { ReportInfographic } from "@/components/ReportInfographic";
import { getCategory } from "@/lib/report-cache.functions";
import type { ReportSection } from "@/data/mock-report";
import { ONSITE_CHECKLIST_SECTION } from "@/data/onsite-checklist";


import { formatSettlement, type Settlement } from "@/lib/settlements";


const TITLE = "Къде Да — проучване на населени места";
const DESCRIPTION =
  "Къде Да събира подробна информация за села и малки градове: инфраструктура, ВиК, транспорт, сигурност, услуги и местни новини.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kadeda.eu/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://kadeda.eu/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Къде Да",
          url: "https://kadeda.eu/",
          description: DESCRIPTION,
          applicationCategory: "LifestyleApplication",
          operatingSystem: "Web",
          inLanguage: "bg",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BGN" },
        }),
      },
    ],
  }),
  component: Index,
});


const IS_MOCK = REPORT_DATA_SOURCE === "mock";

const HERO_PHRASES = [
  "живея",
  "се установя",
  "се преместя",
  "отгледам дете",
  "се пенсионирам",
  "си купя имот",
  "си купя вила",
  "купя земя",
  "строя къща",
  "инвестирам",
  "наема жилище",
  "прекарам старините си",
  "заживея спокойно",
  "намеря спокойствие",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Index() {
  const [place, setPlace] = useState<Settlement | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Settlement | null>(null);
  const placeType: PlaceType = place?.isVillage ? "village" : "town";
  const [purpose, setPurpose] = useState<PurposeId | null>(null);
  const [placeNotice, setPlaceNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [realSections, setRealSections] = useState<ReportSection[] | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [activePhrase, setActivePhrase] = useState(0);

  useEffect(() => {
    setAccessCode(localStorage.getItem("kade-da-access-code") ?? "");
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActivePhrase((i) => (i + 1) % HERO_PHRASES.length);
    }, 3000);
    return () => clearInterval(id);
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

  const categoryIds = PROMPT_MODULES.map((m) => m.id);

  const generateMock = async () => {
    setGenerating(true);
    setRealSections(null);
    setProgress({ done: 0, total: categoryIds.length + (purpose ? 1 : 0) + 1 });
    const collected: ReportSection[] = [];

    for (const categoryId of categoryIds) {
      await sleep(150);
      collected.push(generateMockCategory(categoryId));
      setRealSections([...collected]);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    if (purpose) {
      await sleep(150);
      collected.push(generateMockPerspectiveSummary(purpose));
      setRealSections([...collected]);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    await sleep(150);
    collected.push(ONSITE_CHECKLIST_SECTION);
    setRealSections([...collected]);
    setProgress((p) => ({ ...p, done: p.done + 1 }));

    setGenerating(false);
    toast.success("Докладът е готов (примерни данни).");
  };

  const generateLive = async () => {
    if (!place) return;
    const code = accessCode.trim();
    if (!code) {
      toast.error("Въведете код за достъп (затворен тест).");
      return;
    }
    localStorage.setItem("kade-da-access-code", code);
    setGenerating(true);
    setRealSections(null);
    setProgress({ done: 0, total: categoryIds.length + (purpose ? 1 : 0) + 1 });
    const collected: ReportSection[] = [];
    let failed = 0;

    for (const categoryId of categoryIds) {
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

    // TODO: свържи реалния perspective-summary генератор, когато REPORT_DATA_SOURCE = "live"
    // (все още няма имплементация — пропускаме тихо, ако purpose е избран).
    if (purpose) {
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    collected.push(ONSITE_CHECKLIST_SECTION);
    setRealSections([...collected]);
    setProgress((p) => ({ ...p, done: p.done + 1 }));

    setGenerating(false);
    if (collected.length === 0) {
      toast.error("Докладът не можа да бъде генериран.");
    } else if (failed > 0) {
      toast.warning(`Готово с ${failed} пропуснати категории.`);
    } else {
      toast.success("Докладът е готов.");
    }
  };

  const generateReport = () => (IS_MOCK ? generateMock() : generateLive());

  const reset = () => {
    setPlace(null);
    setCurrentLocation(null);
    setPurpose(null);
    setRealSections(null);
    setProgress({ done: 0, total: 0 });
  };


  return (
    <main className="relative min-h-screen bg-background/80">
      <TopoBackground />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">

        <header className="mount-rise border-b border-border pb-8 text-center">
          <div className="inline-flex w-fit max-w-full flex-col items-center justify-center gap-1 rounded-xl border border-primary/40 bg-foreground px-4 py-2 text-5xl font-bold tracking-normal shadow-lg sm:px-5 sm:text-6xl">
            <h1 className="inline-block shrink-0 whitespace-nowrap">
              <span className="title-part title-part-1 whitespace-nowrap text-background">Къде</span>{" "}
              <span className="title-part title-part-2 whitespace-nowrap text-destructive">Да</span>
            </h1>
            <span
              aria-hidden="true"
              className="title-part title-part-3 relative inline-block h-[1.1em] shrink-0 text-5xl text-primary transition-[width] duration-300 ease-in-out sm:text-6xl"
            >
              <span className="invisible block select-none whitespace-nowrap">
                {HERO_PHRASES[activePhrase]}
              </span>
              {HERO_PHRASES.map((word, i) => (
                <span
                  key={word}
                  className={`cycle-word cycle-word-${i + 1} absolute inset-0 flex items-center justify-center whitespace-nowrap`}
                >
                  {word}
                </span>
              ))}
            </span>
          </div>

          <p className="mt-4 text-base text-muted-foreground">
            Приложението е създадено с една основна цел: да ви спести десетки часове в проучвания,
            събирайки на едно място детайлна и труднодостъпна информация за всяко село или град. Вместо
            да ровите из десетки регистри, форуми и разпокъсани източници, Къде Да синтезира всичко
            необходимо в кратък, структуриран и удобен за четене доклад.
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            Независимо дали търсите потенциална инвестиция, планирате спокоен живот на село със
            семейството и децата си, или търсите подходящо и уредено място за възрастни хора,
            приложението ви предоставя ключовите детайли на едно място. С няколко клика получавате ясна
            картина, готова за бързо и обективно съпоставяне на различните възможности.
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
              Кажете ни за какво търсите имота
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              По желание — изберете една цел, за да добавим обобщена оценка накрая.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {PURPOSE_OPTIONS.map((p) => (
                <ModuleCard
                  key={p.id}
                  variant="radio"
                  module={{ id: p.id, label: p.label, info: p.hint }}
                  selected={purpose === p.id}
                  onToggle={() => setPurpose((cur) => (cur === p.id ? null : p.id))}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <Button onClick={reset} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4" />
                Изчисти
              </Button>
            </div>
          </section>
        )}

        {hasPlace && (
          <section className="mt-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="text-lg font-bold text-destructive">
                Генерирай доклад
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {IS_MOCK
                  ? "Демо режим: докладът се попълва с примерни данни, без реални заявки."
                  : "Приложението ще проучи категориите с Gemini и търсене в Google в реално време и ще покаже резултата тук като инфографика."}
              </p>
              {!IS_MOCK && (
                <>
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
                </>
              )}
              <Button
                size="lg"
                onClick={generateReport}
                disabled={generating || !hasPlace || (!IS_MOCK && !accessCode.trim())}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating
                  ? `Генериране… ${progress.done}/${progress.total}`
                  : "Генерирай доклад"}
              </Button>
              {IS_MOCK && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={generateMock}
                  disabled={generating || !hasPlace}
                >
                  <RefreshCw className="h-4 w-4" />
                  Регенерирай примерни данни
                </Button>
              )}
            </div>

            {(generating || realSections) && (
              <div className="mt-8 space-y-6">
                {realSections && realSections.length > 0 && (
                  <ReportInfographic
                    place={place}
                    current={currentLocation}
                    sections={realSections}
                    demo={false}
                    purpose={purpose}
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

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          Проектът е с нестопанска цел, в подкрепа на купувачите на имоти, в процес на активна разработка.
          <FeedbackBox />
        </footer>


      </div>
    </main>
  );
}
