import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PURPOSE_OPTIONS, type PurposeId } from "@/lib/prompt-modules";
import { SettlementCombobox } from "@/components/SettlementCombobox";
import { ModuleCard } from "@/components/ModuleCard";
import { TopoBackground } from "@/components/TopoBackground";
import { FeedbackBox } from "@/components/FeedbackBox";
import { PendingApproval } from "@/components/PendingApproval";
import { ReportInfographic } from "@/components/ReportInfographic";
import { useAuth } from "@/hooks/useAuth";
import {
  generateReportSections,
  serializeReport,
  parseReport,
  totalSteps,
  IS_MOCK,
} from "@/lib/generate-report";
import { saveReport } from "@/lib/reports.functions";
import { getPublicReport, listPublicPlaces, type PublicPlace } from "@/lib/public-reports.functions";
import type { ReportSection } from "@/data/mock-report";


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

function Index() {
  const { user, profile, loading: authLoading } = useAuth();
  const isSignedIn = user !== null;
  const isApproved = profile?.is_approved === true;

  const [place, setPlace] = useState<Settlement | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Settlement | null>(null);
  const [purpose, setPurpose] = useState<PurposeId | null>(null);
  const [placeNotice, setPlaceNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [realSections, setRealSections] = useState<ReportSection[] | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicPlaces, setPublicPlaces] = useState<PublicPlace[] | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestReport, setGuestReport] = useState<
    { place: Settlement; current: Settlement | null; purpose: PurposeId | null; sections: ReportSection[] } | null
  >(null);
  const [activePhrase, setActivePhrase] = useState(0);
  const [maxPhraseWidth, setMaxPhraseWidth] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setPublicPlaces(null);
      return;
    }
    let active = true;
    listPublicPlaces()
      .then((rows) => {
        if (active) setPublicPlaces(rows);
      })
      .catch(() => {
        if (active) setPublicPlaces([]);
      });
    return () => {
      active = false;
    };
  }, [isSignedIn]);


  useEffect(() => {
    const id = setInterval(() => {
      setActivePhrase((i) => (i + 1) % HERO_PHRASES.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const measureRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!measureRef.current) return;
    const spans = measureRef.current.querySelectorAll("span");
    let max = 0;
    spans.forEach((span) => {
      const width = span.getBoundingClientRect().width;
      if (width > max) max = width;
    });
    setMaxPhraseWidth(max);
  }, []);


  const [currentNotice, setCurrentNotice] = useState<string | null>(null);

  const CONFLICT_MSG =
    "Настоящата локация не може да съвпада с търсеното населено място — полето беше изчистено.";

  const loadGuestReport = async (s: Settlement) => {
    const match = publicPlaces?.find((p) => p.ekatte === s.ekatte);
    if (!match) return;
    setGuestLoading(true);
    setGuestReport(null);
    try {
      const row = await getPublicReport({ data: { id: match.reportId } });
      const payload = row ? parseReport(row.report_content) : null;
      if (!payload) {
        toast.error("Докладът не може да бъде показан.");
        return;
      }
      setGuestReport({
        place: payload.place ?? s,
        current: payload.current ?? null,
        purpose: payload.purpose ?? null,
        sections: payload.sections,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешно зареждане на доклада.");
    } finally {
      setGuestLoading(false);
    }
  };

  const handlePlaceChange = (s: Settlement | null) => {
    setPlace(s);
    setPlaceNotice(null);
    setGuestReport(null);
    if (s && currentLocation && currentLocation.ekatte === s.ekatte) {
      setCurrentLocation(null);
      setCurrentNotice(CONFLICT_MSG);
    } else {
      setCurrentNotice(null);
    }
    if (s && !isSignedIn) void loadGuestReport(s);
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

  const generateReport = async () => {
    if (!place) return;
    setGenerating(true);
    setRealSections(null);
    setProgress({ done: 0, total: totalSteps(purpose) });

    try {
      const { sections, failed } = await generateReportSections({
        place,
        current: currentLocation,
        purpose,
        onSections: (s) => setRealSections(s),
        onStep: () => setProgress((p) => ({ ...p, done: p.done + 1 })),
      });

      if (sections.length === 0) {
        toast.error("Докладът не можа да бъде генериран.");
        return;
      }

      try {
        await saveReport({
          data: {
            locationQuery: formatSettlement(place),
            ekatte: place.ekatte,
            placeName: formatSettlement(place),
            selectedTopics: purpose ? [purpose] : [],
            reportContent: serializeReport({ place, current: currentLocation, purpose, sections }),
            isPublic: !isPrivate,
          },
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? `Докладът не беше запазен: ${err.message}` : "Докладът не беше запазен.",
        );
      }

      if (failed > 0) {
        toast.warning(`Готово с ${failed} пропуснати категории.`);
      } else {
        toast.success(IS_MOCK ? "Докладът е готов (примерни данни)." : "Докладът е готов.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при генерирането.");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setPlace(null);
    setCurrentLocation(null);
    setPurpose(null);
    setRealSections(null);
    setGuestReport(null);
    setProgress({ done: 0, total: 0 });
  };



  return (
    <main className="relative min-h-screen bg-background/80">
      <TopoBackground />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">

        <header className="mount-rise border-b border-border pb-8 text-center">
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none absolute opacity-0"
          >
            {HERO_PHRASES.map((phrase) => (
              <span
                key={phrase}
                className="block whitespace-nowrap text-6xl font-bold"
              >
                {phrase}
              </span>
            ))}
          </div>
          <div
            className="inline-flex w-full max-w-full flex-col items-center justify-center gap-1 px-4 py-2 text-5xl font-bold tracking-normal sm:w-fit sm:px-5 sm:text-6xl"
            style={{
              width: isDesktop && maxPhraseWidth ? `${maxPhraseWidth + 40}px` : undefined,
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <img
                src="/logo-icon.png"
                alt="Къде Да лого"
                width={64}
                height={64}
                className="h-12 w-12 shrink-0 sm:h-16 sm:w-16"
              />
              <h1 className="inline-block shrink-0 whitespace-nowrap">
                <span className="title-part title-part-1 logo-text whitespace-nowrap text-white">
                  Къде
                </span>{" "}
                <span className="title-part title-part-2 logo-text whitespace-nowrap text-destructive">
                  Да
                </span>
              </h1>
            </div>
            <span
              aria-hidden="true"
              className="title-part title-part-3 logo-text relative inline-block h-[1.1em] w-full shrink-0 text-5xl text-primary sm:text-6xl"
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
              allowedEkatte={isSignedIn ? null : (publicPlaces?.map((p) => p.ekatte) ?? [])}
              notice={placeNotice}
            />

            {!isSignedIn && !authLoading && (
              <p className="rounded-lg border border-border bg-card/70 p-3 text-sm text-muted-foreground">
                Без акаунт можете да разглеждате само вече генерирани публични доклади.{" "}
                <Link to="/vhod" className="font-medium text-primary underline">
                  Регистрирайте се
                </Link>
                , за да получите нов, персонализиран доклад за избрано от вас място.
              </p>
            )}





            {hasPlace && isSignedIn && (

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



        {hasPlace && isSignedIn && (

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

        {hasPlace && !isSignedIn && (
          <section className="mt-12">
            {guestLoading && (
              <p className="text-center text-sm text-muted-foreground">Зареждане на доклада…</p>
            )}
            {guestReport && (
              <>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Разглеждате вече генериран публичен доклад (само за четене).
                </p>
                <ReportInfographic
                  place={guestReport.place}
                  current={guestReport.current}
                  sections={guestReport.sections}
                  demo={false}
                  purpose={guestReport.purpose}
                />
              </>
            )}
          </section>
        )}

        {hasPlace && isSignedIn && !isApproved && !authLoading && (
          <section className="mt-12">
            <PendingApproval />
          </section>
        )}

        {hasPlace && isSignedIn && isApproved && (
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

              <div className="flex items-center gap-2">
                <Checkbox
                  id="private-report"
                  checked={isPrivate}
                  onCheckedChange={(v) => setIsPrivate(v === true)}
                />
                <Label htmlFor="private-report" className="text-sm font-normal">
                  Направи този доклад личен
                </Label>
              </div>

              <Button size="lg" onClick={() => void generateReport()} disabled={generating}>
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
                  onClick={() => void generateReport()}
                  disabled={generating}
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
