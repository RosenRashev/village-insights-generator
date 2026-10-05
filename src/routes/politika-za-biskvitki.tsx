import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politika-za-biskvitki")({
  head: () => ({
    meta: [
      { title: "Политика за бисквитки — Къде Да" },
      {
        name: "description",
        content:
          "Какви бисквитки използва Къде Да сега и в бъдеще, и как да управлявате съгласието си.",
      },
      { property: "og:title", content: "Политика за бисквитки — Къде Да" },
      {
        property: "og:description",
        content: "Информация за бисквитките в Къде Да и управлението на съгласието.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://kadeda.eu/politika-za-biskvitki" },
    ],
    links: [{ rel: "canonical", href: "https://kadeda.eu/politika-za-biskvitki" }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Политика за бисквитки</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Последна актуализация: 5 октомври 2026 г.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Какво са бисквитките</h2>
        <p className="mt-3 text-foreground/90">
          Малки текстови файлове, съхранявани на устройството ви, които помагат сайтът да
          функционира правилно и/или да анализира трафика.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          Какви бисквитки използваме в момента
        </h2>
        <p className="mt-3 text-foreground/90">
          „Къде Да“ не използва бисквитки за анализи или реклама. Използваме само технически
          необходимо съхранение в браузъра: ако влезете в профила си, браузърът съхранява
          сесията ви (локално съхранение), за да останете влезли. Без него вход в профила не е
          възможен.
        </p>
        <p className="mt-3 text-foreground/90">
          Сайтът зарежда шрифтове от Google Fonts, а картата — плочки от OpenStreetMap. Тези
          услуги получават IP адреса ви при зареждането им. Подробности — в Политиката за
          поверителност.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          Какви бисквитки планираме да добавим
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-foreground/90">
          <li>
            Аналитични бисквитки (напр. Google Analytics) — за разбиране как посетителите
            използват сайта.
          </li>
          <li>
            Рекламни бисквитки — при показване на банерни/видео реклами, рекламните партньори
            може да поставят бисквитки за персонализация.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Съгласие</h2>
        <p className="mt-3 text-foreground/90">
          Когато добавим аналитични или рекламни бисквитки, при първо посещение ще виждате банер
          за съгласие, през който можете да приемете, откажете или персонализирате избора си.
          Можете да промените съгласието си по всяко време чрез настройките на банера в footer-а
          на сайта.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          Управление на бисквитки от браузъра
        </h2>
        <p className="mt-3 text-foreground/90">
          Можете също да изтриете или блокирате бисквитки директно от настройките на вашия
          браузър, макар това да може да ограничи функционалността на сайта.
        </p>
      </section>
    </article>
  );
}
