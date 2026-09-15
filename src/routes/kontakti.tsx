import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/kontakti")({
  head: () => ({
    meta: [
      { title: "Контакти и информация за проекта — Къде Да" },
      {
        name: "description",
        content:
          "Кой стои зад Къде Да и как да се свържете с нас за въпроси, обратна връзка или партньорства.",
      },
      { property: "og:title", content: "Контакти и информация за проекта — Къде Да" },
      {
        property: "og:description",
        content: "Свържете се с екипа на Къде Да за въпроси, обратна връзка или партньорства.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://kadeda.eu/kontakti" },
    ],
    links: [{ rel: "canonical", href: "https://kadeda.eu/kontakti" }],
  }),
  component: ContactsPage,
});

const DOMAIN = "kadeda.eu";

function ContactsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Контакти / За нас</h1>

      <p className="mt-6 text-lg text-foreground/90">
        „Къде Да“ е инструмент, който помага да проучите населено място, квартал или имот, преди
        да вземете решение — дали да живеете там, да се преместите, или да купите имот.
      </p>

      <dl className="mt-10 space-y-4">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Собственик и оператор</dt>
          <dd className="mt-1 text-foreground">Росен Рашев</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Локация</dt>
          <dd className="mt-1 text-foreground">Стара Загора, България</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Контакт</dt>
          <dd className="mt-1 text-foreground">
            <a href={`mailto:contact@${DOMAIN}`} className="text-primary underline">
              contact@{DOMAIN}
            </a>
          </dd>
        </div>
      </dl>

      <p className="mt-10 text-foreground/90">
        Проектът се разработва самостоятелно и постоянно се разширява с нови функции. За
        въпроси, обратна връзка или партньорства, пишете директно на посочения имейл.
      </p>
    </article>
  );
}
