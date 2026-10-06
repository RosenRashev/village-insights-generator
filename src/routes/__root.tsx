import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { FeedbackBox } from "../components/FeedbackBox";
import { InstallAppButton } from "../components/InstallAppButton";
import { Toaster } from "../components/ui/sonner";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { ReportSessionProvider } from "../hooks/useReportSession";
import { registerServiceWorker } from "../lib/pwa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md text-center">
        <img
          src="/logo-icon.png"
          alt="Къде Да"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
        <h1 className="logo-text mt-4 text-7xl font-bold text-destructive">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страницата не е намерена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Адресът може да е грешен или страницата да е преместена. Върнете се в началото и потърсете
          населеното място, което ви интересува.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Към началната страница
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md text-center">
        <img
          src="/logo-icon.png"
          alt="Къде Да"
          width={72}
          height={72}
          className="mx-auto h-[72px] w-[72px]"
        />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Страницата не се зареди
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Нещо се обърка от наша страна. Опитайте да презаредите или се върнете в началото.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Опитай отново
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Към началото
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Къде Да — проучване на населени места" },
      {
        name: "description",
        content: "Подробни доклади за инфраструктурата, услугите и средата в села и малки градове.",
      },
      { name: "author", content: "Къде Да" },
      { name: "theme-color", content: "#0f7a3d" },
      { name: "application-name", content: "Къде Да" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Къде Да" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "msapplication-TileColor", content: "#0f7a3d" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "Къде Да — проучване на населени места" },
      {
        property: "og:description",
        content: "Подробни доклади за инфраструктурата, услугите и средата в села и малки градове.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://kadeda.eu/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Къде Да — лого" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://kadeda.eu/og-image.jpg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Marcellus&family=Baloo+2:wght@700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    // Хваща събитието за инсталиране, ако се появи преди да се зареди React.
    scripts: [
      {
        children:
          "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__deferredInstall=e;});",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bg">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const FOOTER_LINKS = [
  { to: "/politika-za-poveritelnost", label: "Политика за поверителност" },
  { to: "/obshti-usloviya", label: "Общи условия" },
  { to: "/politika-za-biskvitki", label: "Политика за бисквитки" },
  { to: "/kontakti", label: "Контакти" },
] as const;

function SiteFooter() {
  return (
    <footer className="print:hidden border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-6 text-sm">
        <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {FOOTER_LINKS.map((link, i) => (
            <span key={link.to} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground/50">|</span>}
              <Link
                to={link.to}
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">© 2026 Къде Да</p>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Върни се най-горе"
      className={[
        "print:hidden",
        "fixed bottom-5 right-5 z-50 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}

function UserAvatar({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const avatarUrl =
    (typeof metadata["avatar_url"] === "string" && metadata["avatar_url"]) ||
    (typeof metadata["picture"] === "string" && metadata["picture"]) ||
    null;
  const displayName =
    (typeof metadata["full_name"] === "string" && metadata["full_name"]) ||
    (typeof metadata["name"] === "string" && metadata["name"]) ||
    user.email ||
    "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ? `Профилна снимка на ${displayName}` : "Профилна снимка"}
        title={displayName || undefined}
        referrerPolicy="no-referrer"
        className="h-7 w-7 rounded-full border border-border object-cover"
        onError={(e) => {
          // Ако Google снимката не успее да се зареди, скриваме img-а, за да не остане счупена икона.
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <span
      title={displayName || undefined}
      className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function SiteHeader() {
  const { user, profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="print:hidden border-b border-border bg-background/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Къде Да — начало">
          <img src="/logo-icon.png" alt="" width={28} height={28} className="h-7 w-7" />
          {pathname !== "/" && (
            <span className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80">
              <span aria-hidden="true">←</span> Начало
            </span>
          )}
        </Link>
        {pathname === "/" && <div aria-hidden="true" />}
        <nav className="flex items-center gap-3">
          <Link to="/sravnenie" className="text-muted-foreground hover:text-primary">
            Сравнение
          </Link>
          {user ? (
            <>
              <UserAvatar user={user} />
              {profile?.is_admin && (
                <Link to="/admin" className="text-muted-foreground hover:text-primary">
                  Админ
                </Link>
              )}
              <Link to="/profil" className="text-muted-foreground hover:text-primary">
                Моите доклади
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-muted-foreground hover:text-primary"
              >
                Изход
              </button>
            </>
          ) : (
            <Link to="/vhod" className="font-medium text-primary hover:underline">
              Вход / Регистрация
            </Link>
          )}
          <InstallAppButton />
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ReportSessionProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex-1">
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
            </div>
            <SiteFooter />
          </div>
          <ScrollToTop />
          <FeedbackBox />
          <Toaster />
        </ReportSessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
