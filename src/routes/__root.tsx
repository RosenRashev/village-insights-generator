import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "../hooks/useAuth";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { property: "og:title", content: "Къде Да — проучване на населени места" },
      {
        property: "og:description",
        content: "Подробни доклади за инфраструктурата, услугите и средата в села и малки градове.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Marcellus&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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

function SiteHeader() {
  const { user, profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="border-b border-border bg-background/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm">
        {pathname !== "/" && (
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
          >
            <span aria-hidden="true">←</span> Начало
          </Link>
        )}
        {pathname === "/" && <div aria-hidden="true" />}
        <nav className="flex items-center gap-3">
          {user ? (
            <>
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
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </div>
          <SiteFooter />
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

