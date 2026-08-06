import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, House, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildPrompt } from "@/lib/build-prompt";
import { PROMPT_MODULES, type PlaceType } from "@/lib/prompt-modules";
import { SettlementCombobox } from "@/components/SettlementCombobox";
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

function Index() {
  const [place, setPlace] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const placeType: PlaceType = "village";
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const hasPlace = place.trim().length > 1;
  const prompt = useMemo(
    () => buildPrompt({ place, placeType, selected, currentLocation }),
    [place, placeType, selected, currentLocation],
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
      toast.error("Копирането не успя — опитайте отново");
    }
  };

  const reset = () => {
    setPlace("");
    setCurrentLocation("");
    setSelected([]);
  };


  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <header className="border-b border-border pb-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl [text-shadow:0_2px_6px_hsl(0_0%_0%/0.35)]">
            <span className="text-background [-webkit-text-stroke:1px_hsl(0_0%_45%)]">
              Да се
            </span>{" "}
            <span className="text-primary">върнем</span>{" "}
            <span className="text-destructive">на село</span>
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
                <div
                  key={m.id}
                  className="flex h-full items-start gap-3 rounded-lg border border-border p-4"
                >
                  <Checkbox
                    id={m.id}
                    checked={selected.includes(m.id)}
                    onCheckedChange={() => toggle(m.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={m.id}
                      className="cursor-pointer text-sm font-semibold"
                    >
                      {m.label}
                    </Label>
                    <p className="mt-1 text-sm text-muted-foreground">{m.info}</p>
                  </div>
                </div>
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
            <button
              type="button"
              onClick={copy}
              aria-label="Копирай промпта"
              className="group flex h-28 w-28 flex-col items-center justify-center gap-1 bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 [clip-path:polygon(50%_0%,100%_38%,100%_100%,0%_100%,0%_38%)]"
            >
              {copied ? (
                <Check className="mt-5 h-8 w-8" />
              ) : (
                <House className="mt-5 h-8 w-8" />
              )}
              <span className="text-xs font-semibold">
                {copied ? "Копирано" : "Копирай"}
              </span>
            </button>
            <Button onClick={reset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" />
              Изчисти
            </Button>
          </section>
        )}

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground whitespace-pre-line">
          За приложението: Ролята на този инструмент е да генерира прецизно структурирана инструкция, която да насочи изкуствения интелект да търси точно определени факти, вместо да генерира общи или измислени отговори.

          Проектът е с нестопанска цел, създаден е в подкрепа на купувачите на имоти и в момента се намира в процес на активна разработка.
        </footer>
      </div>
    </main>
  );
}
