import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import {
  PROMPT_MODULES,
  PURPOSE_OPTIONS,
  type PlaceType,
  type PurposeId,
} from "@/lib/prompt-modules";
import { ADDON_MODULES } from "@/lib/addon-modules";
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

const IS_MOCK = REPORT_DATA_SOURCE === "mock";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Index() {
  const [place, setPlace] = useState<Settlement | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Settlement | null>(null);
  const placeType: PlaceType = place?.isVillage ? "village" : "town";
  const [purpose, setPurpose] = useState<PurposeId | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
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

  const toggleAddon = (id: string) =>
    setAddons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const categoryIds = [
    ...PROMPT_MODULES.map((m) => m.id),
    ...ADDON_MODULES.filter((a) => addons.includes(a.id)).map((a) => a.id),
  ];

  const generateMock = async () => {
    setGenerating(true);
    setRealSections(null);
    setProgress({ done: 0, total: categoryIds.length + (purpose ? 1 : 0) });
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
    localStorage.setItem("seloskop-access-code", code);
    setGenerating(true);
    setRealSections(null);
    setProgress({ done: 0, total: categoryIds.length });
    const collected: ReportSection[] = [];
    let failed = 0;

    for (const categoryId of categoryIds) {
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

    // TODO: свържи реалния perspective-summary генератор, когато REPORT_DATA_SOURCE = "live"
    // (все още няма имплементация — пропускаме тихо, ако purpose е избран).

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
    setAddons([]);
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
            <p className="text-sm text-muted-foreground">
              Проучването винаги включва пълния набор от категории:{" "}
              {PROMPT_MODULES.map((m) => m.label).join(", ")}.
            </p>

            <h2 className="mt-8 text-lg font-bold text-destructive">
              Цел на търсенето
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              По желание — изберете една цел, за да добавим обобщена оценка накрая.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <h2 className="mt-10 text-lg font-bold text-destructive">
              Допълнителни опции
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ADDON_MODULES.map((a) => (
                <ModuleCard
                  key={a.id}
                  module={a}
                  selected={addons.includes(a.id)}
                  onToggle={() => toggleAddon(a.id)}
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
            </div>

            {(generating || realSections) && (
              <div className="mt-8 space-y-6">
                {realSections && realSections.length > 0 && (
                  <ReportInfographic
                    place={place}
                    current={currentLocation}
                    sections={realSections}
                    demo={false}
                    onRegenerate={IS_MOCK ? generateMock : undefined}
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
              <ReportInfographic
                place={place}
                current={currentLocation}
                onRegenerate={IS_MOCK ? generateMock : undefined}
              />
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
