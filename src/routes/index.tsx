import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PURPOSE_OPTIONS, type PurposeId } from "@/lib/purposes";
import { FieldHint } from "@/components/FieldHint";
import { SettlementCombobox } from "@/components/SettlementCombobox";
import { ModuleCard } from "@/components/ModuleCard";
import { TopoBackground } from "@/components/TopoBackground";
import { PendingApproval } from "@/components/PendingApproval";
import { OPEN_CREDITS_EVENT } from "@/components/CreditsBadge";
import { GenerationProgress } from "@/components/GenerationProgress";
import { ReportInfographic } from "@/components/ReportInfographic";
import { useAuth } from "@/hooks/useAuth";
import { useReportSession } from "@/hooks/useReportSession";
import {
  generateReportSections,
  serializeReport,
  parseReport,
  totalSteps,
  IS_MOCK,
} from "@/lib/generate-report";
import {
  findMyReportByEkatte,
  getMyReportByEkatte,
  getMyQuota,
  saveReport,
  type MyReportSummary,
} from "@/lib/reports.functions";
import { canUsePurpose } from "@/lib/plans";
import type { ReportSection } from "@/data/mock-report";

import { displaySettlement, formatSettlement, type Settlement } from "@/lib/settlements";

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
  const purposeAllowed = canUsePurpose(profile);
  const queryClient = useQueryClient();

  const {
    place,
    setPlace,
    currentLocation,
    setCurrentLocation,
    purpose,
    setPurpose,
    isPrivate,
    setIsPrivate,
    generating,
    setGenerating,
    progress,
    setProgress,
    realSections,
    setRealSections,
    reportFor,
    setReportFor,
    generatedAt,
    setGeneratedAt,
    reset: resetSession,
  } = useReportSession();
  const [placeNotice, setPlaceNotice] = useState<string | null>(null);
  const [activePhrase, setActivePhrase] = useState(0);
  const [maxPhraseWidth, setMaxPhraseWidth] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

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

  // Има ли потребителят вече доклад за избраното място — тогава вместо „Генерирай“ се предлага „Актуализирай“.
  // Резултатът се кешира, за да няма повторна заявка при всяко връщане на страницата.
  const placeEkatte = place?.ekatte;
  const existingQuery = useQuery({
    queryKey: ["my-report-summary", user?.id, placeEkatte],
    queryFn: () => findMyReportByEkatte({ data: { ekatte: placeEkatte! } }),
    enabled: !!placeEkatte && isSignedIn && isApproved,
    staleTime: 5 * 60_000,
  });
  // Броят налични доклади (същият кеш като кутийката в хедъра) — за предупреждението за последен доклад.
  const quotaQuery = useQuery({
    queryKey: ["my-quota", user?.id],
    queryFn: () => getMyQuota({ data: undefined }),
    enabled: isSignedIn && isApproved,
    staleTime: 60_000,
  });
  const existingReport: MyReportSummary | null =
    placeEkatte && isSignedIn && isApproved ? (existingQuery.data ?? null) : null;

  // Докладът на екрана се показва само за мястото, за което е генериран — иначе при смяна на
  // избраното място заглавието би било за едно място, а данните за друго.
  const showReport = realSections !== null && reportFor?.place.ekatte === place?.ekatte;

  // Вече запазеният доклад на потребителя за това място се показва направо (без ново генериране).
  // Същият ключ като в /report/$ekatte — споделя кеша и се освежава при запазване.
  const savedQuery = useQuery({
    queryKey: ["my-report", "row", user?.id, placeEkatte],
    queryFn: () => getMyReportByEkatte({ data: { ekatte: placeEkatte! } }),
    enabled: existingReport !== null && !generating && !showReport,
    staleTime: 5 * 60_000,
  });
  const savedRow =
    existingReport !== null && !savedQuery.isError ? (savedQuery.data ?? null) : null;
  const savedPayload = savedRow ? parseReport(savedRow.report_content) : null;
  const showSaved =
    !generating &&
    !showReport &&
    savedPayload !== null &&
    savedPayload.place.ekatte === placeEkatte;
  const loadingSaved =
    existingReport !== null && !showReport && !generating && savedQuery.isPending;

  // Докато се генерира и след като докладът е готов, информационните балончета не са нужни.
  const hintsOff = generating || showReport || showSaved;

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

  const generateReport = async () => {
    if (!place) return;

    // Лимитът важи за нови доклади, не за актуализация на вече съществуващ.
    if (!existingReport) {
      try {
        const quota = await getMyQuota({ data: undefined });
        if (!quota.allowed) {
          toast.error("Нямате оставащи доклади.", {
            action: {
              label: "Заяви още",
              onClick: () => window.dispatchEvent(new Event(OPEN_CREDITS_EVENT)),
            },
          });
          return;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Неуспешна проверка на лимита.");
        return;
      }
    }

    // Авторът винаги може да зададе настояща локация и цел; публикуването влияе само на това
    // какво виждат другите (личното им се скрива).
    const usedCurrent = currentLocation;
    const usedPurpose = purposeAllowed ? purpose : null;

    setGenerating(true);
    setReportFor({ place, current: usedCurrent });
    setRealSections(null);
    setGeneratedAt(new Date().toISOString());
    setProgress({ done: 0, total: totalSteps(usedPurpose) });

    try {
      const { sections, failed } = await generateReportSections({
        place,
        current: usedCurrent,
        purpose: usedPurpose,
        onSections: (s) => setRealSections(s),
        onStep: () => setProgress((p) => ({ ...p, done: p.done + 1 })),
      });

      if (sections.length === 0) {
        toast.error("Докладът не можа да бъде генериран.");
        return;
      }

      if (failed > 0) {
        // Непълен доклад не се запазва (иначе би се показвал на гостите като „официален“).
        // Успешните категории вече са в кеша, така че повторният опит е евтин.
        toast.warning(
          `Докладът е непълен — ${failed} категории не успяха и той не беше запазен. Опитайте отново след малко.`,
        );
        return;
      }

      try {
        const saved = await saveReport({
          data: {
            locationQuery: formatSettlement(place),
            ekatte: place.ekatte,
            placeName: formatSettlement(place),
            selectedTopics: usedPurpose ? [usedPurpose] : [],
            reportContent: serializeReport({
              place,
              current: usedCurrent,
              purpose: usedPurpose,
              sections,
            }),
            isPublic: !isPrivate,
          },
        });
        // „Сравнение“ да види новия/обновения доклад.
        void queryClient.invalidateQueries({ queryKey: ["my-report-places"] });
        void queryClient.invalidateQueries({ queryKey: ["my-report"] });
        void queryClient.invalidateQueries({ queryKey: ["my-reports"] });
        void queryClient.invalidateQueries({ queryKey: ["my-quota"] });
        void queryClient.invalidateQueries({ queryKey: ["my-credit-history"] });
        void queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
        queryClient.setQueryData(["my-report-summary", user?.id, place.ekatte], {
          id: saved.id,
          is_public: !isPrivate,
          updated_at: new Date().toISOString(),
        } satisfies MyReportSummary);
        toast.success(
          IS_MOCK
            ? "Докладът е готов (примерни данни)."
            : saved.updated
              ? "Докладът е актуализиран."
              : "Докладът е готов.",
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Докладът не беше запазен: ${err.message}`
            : "Докладът не беше запазен.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при генерирането.");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => resetSession();

  return (
    <main className="relative min-h-screen bg-background/80">
      <TopoBackground />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <header className="mount-rise border-b border-border pb-8 text-center">
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-[-9999px] top-0"
          >
            {HERO_PHRASES.map((phrase) => (
              <span key={phrase} className="block whitespace-nowrap text-6xl font-bold">
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
              className="title-part title-part-3 logo-text relative inline-block h-[1.1em] w-full max-w-full shrink-0 overflow-x-clip text-[clamp(1.35rem,7vw,1.875rem)] text-primary sm:text-6xl"
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
            събирайки на едно място детайлна и труднодостъпна информация за всяко село или град.
            Вместо да ровите из десетки регистри, форуми и разпокъсани източници, Къде Да синтезира
            всичко необходимо в кратък, структуриран и удобен за четене доклад.
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            Независимо дали търсите потенциална инвестиция, планирате спокоен живот на село със
            семейството и децата си, или търсите подходящо и уредено място за възрастни хора,
            приложението ви предоставя ключовите детайли на едно място. С няколко клика получавате
            ясна картина, готова за бързо и обективно съпоставяне на различните възможности.
          </p>
        </header>

        <section className="mount-rise-delay mt-10">
          <h2 className="text-center text-2xl font-bold text-primary sm:text-3xl">
            Кое населено място проучвате?
          </h2>
          <div className="mt-4 space-y-4">
            <FieldHint
              disabled={hintsOff}
              title="Населено място"
              text="В това поле въведете населеното място, което искате да разучите или за което искате да получите информация. Можете да търсите по име или по пощенски код."
            >
              <SettlementCombobox
                id="place"
                label="Населено място или пощенски код"
                placeholder="напр. Баня или 4360"
                value={place}
                onChange={handlePlaceChange}
                excludeLargeCities
                notice={placeNotice}
              />
            </FieldHint>

            {!isSignedIn && !authLoading && (
              <p className="rounded-lg border border-border bg-card/70 p-3 text-sm text-muted-foreground">
                Докладите са достъпни само за регистрирани потребители.{" "}
                <Link to="/vhod" className="font-medium text-primary underline">
                  Влезте или се регистрирайте
                </Link>
                , за да разглеждате доклади и да получите нов за избрано от вас място.
              </p>
            )}

            {hasPlace && isSignedIn && isApproved && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <FieldHint
                  disabled={hintsOff}
                  className="space-y-2"
                  title="Настояща локация"
                  text="По желание задайте мястото, на което се намирате в момента. То ще се включи като контекст в доклада — например разстояние и време за пътуване до избраното място. Вижда се само от вас."
                >
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
                    Въведете населеното място, в което живеете в момента, за да изчислим
                    разстоянието, времето за пътуване и транспортната достъпност за имоти купувани с
                    цел уикенд туризъм за отдих и почивка.
                  </p>
                </FieldHint>

                <div className="rounded-lg border border-border bg-card/70 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="private-report"
                      checked={isPrivate}
                      onCheckedChange={(v) => setIsPrivate(v === true)}
                    />
                    <Label htmlFor="private-report" className="text-sm font-medium">
                      Направи този доклад личен
                    </Label>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isPrivate
                      ? "Докладът ще се вижда само от вас."
                      : `Докладът ще се вижда и от другите регистрирани потребители, но без вашата настояща локация${
                          purposeAllowed ? " и цел на търсенето" : ""
                        } — тях виждате само вие.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {hasPlace && isSignedIn && isApproved && purposeAllowed && (
          <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <FieldHint
              disabled={hintsOff}
              title="За какво търсите имота"
              text="Целта дава контекст на доклада — за какво търсите имота — и добавя точкова система (оценка от 1 до 10), която ви помага да се ориентирате по-лесно и да филтрирате релевантната информация."
            >
              <h2 className="pr-8 text-lg font-bold text-destructive">
                Кажете ни за какво търсите имота
              </h2>
              <p className="mt-1 pr-8 text-sm text-muted-foreground">
                По желание — изберете една цел, за да добавим обобщена оценка накрая.
              </p>
            </FieldHint>
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
          </section>
        )}

        {hasPlace && !isSignedIn && !authLoading && (
          <section className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              За да видите доклада за {displaySettlement(place)}, влезте в профила си.
            </p>
            <Button asChild className="mt-4">
              <Link to="/vhod">Вход / Регистрация</Link>
            </Button>
          </section>
        )}

        {hasPlace && isSignedIn && !isApproved && !authLoading && (
          <section className="mt-12">
            <PendingApproval />
          </section>
        )}

        {hasPlace && isSignedIn && isApproved && (
          <section className="mt-16">
            <FieldHint
              disabled={generating}
              className="flex flex-col items-center gap-3 text-center"
              title={existingReport ? "Този доклад е във вашия профил" : "Генерирай доклад"}
              text={
                existingReport
                  ? `Този доклад е генериран във вашия профил на ${new Date(existingReport.updated_at).toLocaleDateString("bg-BG")}. Ако искате да го актуализирате с по-нови данни, влезте в профила си и натиснете бутона „Актуализирай“ в доклада. Актуализацията проучва мястото наново с Gemini и търсене в Google и коства токени, затова я правете само при нужда.`
                  : "Бутонът „Генерирай доклад“ проучва всички категории за избраното място в реално време (с Gemini и търсене в Google) и подрежда резултата като инфографика. Новият доклад се запазва в „Моите доклади“."
              }
            >
              <h2 className="px-8 text-lg font-bold text-destructive">
                {existingReport ? `Доклад за ${place.name}` : "Генерирай доклад"}
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {IS_MOCK
                  ? "Демо режим: докладът се попълва с примерни данни, без реални заявки."
                  : existingReport
                    ? `Генериран във вашия профил на ${new Date(existingReport.updated_at).toLocaleDateString("bg-BG")}. За по-нови данни натиснете „Актуализирай“ (коства токени).`
                    : "Приложението ще проучи категориите с Gemini и търсене в Google в реално време и ще покаже резултата тук като инфографика."}
              </p>

              {generating ? (
                <GenerationProgress
                  done={progress.done}
                  total={progress.total}
                  updating={existingReport !== null}
                />
              ) : existingReport ? (
                <Button size="lg" variant="outline" onClick={() => void generateReport()}>
                  <RefreshCw className="h-4 w-4" />
                  Актуализирай
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={() => void generateReport()}>
                    <Sparkles className="h-4 w-4" />
                    Генерирай доклад
                  </Button>
                  {quotaQuery.data?.unlimited === false && quotaQuery.data.credits === 1 && (
                    <p className="max-w-md rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                      Това е последният ви наличен доклад. След него можете да заявите още от
                      кутийката с доклади до профилната снимка.
                    </p>
                  )}
                </>
              )}
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
              <Button onClick={reset} variant="outline" size="sm" disabled={generating}>
                <RotateCcw className="h-4 w-4" />
                Изчисти
              </Button>
            </FieldHint>

            {(loadingSaved || showSaved) && (
              <div className="mt-8 space-y-6">
                {loadingSaved && (
                  <div className="animate-pulse space-y-4 rounded-[2rem] bg-muted/60 p-6 sm:p-8">
                    <div className="h-6 w-2/3 rounded bg-muted-foreground/20" />
                    <div className="h-4 w-full rounded bg-muted-foreground/15" />
                    <div className="h-24 w-full rounded-2xl bg-muted-foreground/10" />
                  </div>
                )}
                {showSaved && savedPayload && savedRow && (
                  <ReportInfographic
                    place={savedPayload.place}
                    current={savedPayload.current ?? null}
                    sections={savedPayload.sections}
                    demo={false}
                    purpose={purposeAllowed ? (savedPayload.purpose ?? null) : null}
                    generatedAt={savedPayload.generatedAt ?? savedRow.updated_at}
                  />
                )}
              </div>
            )}

            {(generating || showReport) && (
              <div className="mt-8 space-y-6">
                {generating && reportFor && reportFor.place.ekatte !== place?.ekatte && (
                  <p className="text-center text-sm text-muted-foreground">
                    В момента се генерира доклад за {reportFor.place.name} — той ще се покаже,
                    когато изберете това място отново.
                  </p>
                )}
                {showReport && realSections && realSections.length > 0 && reportFor && (
                  <ReportInfographic
                    place={reportFor.place}
                    current={reportFor.current}
                    sections={realSections}
                    demo={false}
                    purpose={purposeAllowed ? purpose : null}
                    generatedAt={generatedAt}
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
          Проектът е с нестопанска цел, в подкрепа на купувачите на имоти, в процес на активна
          разработка.
        </footer>
      </div>
    </main>
  );
}
