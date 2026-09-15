import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/obshti-usloviya")({
  head: () => ({
    meta: [
      { title: "Общи условия — Къде Да" },
      {
        name: "description",
        content:
          "Общи условия за ползване на Къде Да: описание на услугата, отказ от отговорност, лимити и интелектуална собственост.",
      },
      { property: "og:title", content: "Общи условия — Къде Да" },
      {
        property: "og:description",
        content:
          "Условия за ползване на услугата Къде Да и ограничение на отговорността за генерираните доклади.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://kadeda.eu/obshti-usloviya" },
    ],
    links: [{ rel: "canonical", href: "https://kadeda.eu/obshti-usloviya" }],
  }),
  component: TermsPage,
});

const DOMAIN = "kadeda.eu";

function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
        Общи условия за ползване
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Последна актуализация: 15 септември 2026 г.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Приемане на условията</h2>
        <p className="mt-3 text-foreground/90">
          С използването на „Къде Да“ (достъпен на {DOMAIN}) приемате настоящите Общи условия.
          Ако не сте съгласни, моля не използвайте услугата.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Описание на услугата</h2>
        <p className="mt-3 text-foreground/90">
          „Къде Да“ генерира структуриран текстов доклад/проучване за населено място, квартал
          или имот, въз основа на въведени от потребителя параметри (локация и избрани теми).
          Докладите се генерират автоматично с помощта на изкуствен интелект.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          Важен отказ от отговорност относно съдържанието
        </h2>
        <p className="mt-3 text-foreground/90">
          Генерираните доклади може да съдържат неточности, непълноти или устарели данни.
          Информацията се предоставя „както е“, без гаранция за точност, пълнота или актуалност.
          Докладите не представляват правен, финансов, инвестиционен или имотен съвет. Преди да
          вземете решение за покупка на имот, преместване или инвестиция, е силно препоръчително
          да проверите информацията от първоизточник и/или да се консултирате със съответния
          специалист (нотариус, брокер, общинска администрация).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Ограничение на отговорността</h2>
        <p className="mt-3 text-foreground/90">
          Росен Рашев, в качеството на оператор на „Къде Да“, не носи отговорност за вреди
          (пряки или непреки), произтичащи от използването или невъзможността за използване на
          генерираните доклади или самата услуга.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Дневни лимити и Premium функции</h2>
        <p className="mt-3 text-foreground/90">
          Услугата може да предлага безплатен дневен лимит на генерирани доклади, разширяем чрез
          гледане на видео реклама и/или бъдещ платен Premium абонамент. Условията на Premium
          абонамента (цена, обхват, начин на плащане) ще бъдат публикувани отделно преди
          активирането му.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Интелектуална собственост</h2>
        <p className="mt-3 text-foreground/90">
          Дизайнът, логото „Къде Да“ и структурата на сайта са собственост на Росен Рашев.
          Генерираните доклади можете да ползвате свободно за лични цели.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Промени в условията</h2>
        <p className="mt-3 text-foreground/90">
          Условията могат да се променят с известие на сайта. Продължаващото използване на
          услугата след промяна означава приемане на новите условия.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Приложимо право</h2>
        <p className="mt-3 text-foreground/90">
          Настоящите условия се уреждат от законодателството на Република България.
        </p>
      </section>
    </article>
  );
}
