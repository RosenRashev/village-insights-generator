import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politika-za-poveritelnost")({
  head: () => ({
    meta: [
      { title: "Политика за поверителност — Къде Да" },
      {
        name: "description",
        content:
          "Как Къде Да събира, използва и защитава вашите данни, какви са правата ви по GDPR и кой обработва информацията.",
      },
      { property: "og:title", content: "Политика за поверителност — Къде Да" },
      {
        property: "og:description",
        content:
          "Как Къде Да събира, използва и защитава вашите данни, какви са правата ви по GDPR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const DOMAIN = "kadeda.eu";

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
        Политика за поверителност
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Последна актуализация: 15 септември 2026 г.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Кой обработва данните ви</h2>
        <p className="mt-3 text-foreground/90">
          Уебсайтът „Къде Да“ (достъпен на {DOMAIN}) се управлява от Росен Рашев, физическо
          лице, гр. Стара Загора, България. За въпроси, свързани с поверителността на данните,
          можете да се свържете на:{" "}
          <a href={`mailto:contact@${DOMAIN}`} className="text-primary underline">
            contact@{DOMAIN}
          </a>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Какви данни събираме в момента</h2>
        <p className="mt-3 text-foreground/90">
          В настоящия си вид „Къде Да“ не изисква регистрация. За да генерирате доклад,
          въвеждате:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-foreground/90">
          <li>пощенски код или име на населено място/квартал;</li>
          <li>избор на теми чрез чек-бокс (напр. ВИК инфраструктура, етнос, новини).</li>
        </ul>
        <p className="mt-3 text-foreground/90">
          Тези данни се използват единствено за генериране на текстов доклад в самата сесия и
          не се съхраняват свързани с ваша самоличност.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          Какви данни планираме да събираме в бъдеще
        </h2>
        <p className="mt-3 text-foreground/90">
          Услугата се разширява и в бъдеще може да включва:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-foreground/90">
          <li>
            потребителски акаунти (имейл адрес и парола, хеширана, при регистрация за Premium
            функции);
          </li>
          <li>
            анализи на трафика (Google Analytics или подобен инструмент) — анонимизирана
            информация за посещения, устройство, приблизителна локация на ниво град, страници,
            които разглеждате;
          </li>
          <li>
            рекламни партньори — при показване на реклами (вкл. видео реклами за отключване на
            допълнителни доклади), рекламните мрежи могат да поставят собствени бисквитки за
            персонализация на реклами.
          </li>
        </ul>
        <p className="mt-3 text-foreground/90">
          Тази политика ще бъде актуализирана преди активирането на всяка от тези функции, с
          ясно обявена дата на промяна.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Правно основание за обработка</h2>
        <p className="mt-3 text-foreground/90">Обработваме данни въз основа на:</p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-foreground/90">
          <li>изричното ви съгласие (за бисквитки/реклами);</li>
          <li>легитимен интерес за подобряване на услугата (анализи);</li>
          <li>изпълнение на договор (при бъдещи платени абонаменти).</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Вашите права по GDPR</h2>
        <p className="mt-3 text-foreground/90">
          Имате право на: достъп до данните си, коригиране, изтриване, ограничаване на
          обработката, преносимост на данните, и възражение срещу обработка. За упражняване на
          тези права пишете на{" "}
          <a href={`mailto:contact@${DOMAIN}`} className="text-primary underline">
            contact@{DOMAIN}
          </a>
          . Имате право и да подадете жалба до Комисията за защита на личните данни (КЗЛД).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Съхранение на данни</h2>
        <p className="mt-3 text-foreground/90">
          Данни от генерирани доклади не се съхраняват след приключване на сесията, освен ако не
          сте регистриран потребител с активен акаунт (когато тази функция бъде активирана).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Трети страни</h2>
        <p className="mt-3 text-foreground/90">
          Не продаваме и не споделяме лични данни с трети страни, освен доставчици на услуги,
          необходими за функционирането на сайта (хостинг, бъдещи анализи, бъдещи рекламни
          мрежи), всеки от които спазва собствена политика за поверителност.
        </p>
      </section>
    </article>
  );
}
