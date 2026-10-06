import { useCallback, useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { detectInstallMode, isBubbleSnoozed, type InstallMode } from "@/lib/pwa";

/**
 * Бутон „Инсталирай приложението“ за мобилни устройства, с балонче, което приканва
 * потребителя да добави сайта на началния екран. Скрит е, когато вече е инсталирано.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Събитието се хваща от вграден скрипт още преди зареждането на React. */
    __deferredInstall?: BeforeInstallPromptEvent | null;
  }
}

const DISMISS_KEY = "kadeda:install-bubble-dismissed";

function readDismissed(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton() {
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [open, setOpen] = useState(false);
  // Инсталирано в тази сесия — бутонът изчезва, дори браузърът още да е в обикновен раздел.
  const [installed, setInstalled] = useState(false);

  const refresh = useCallback(() => {
    setMode(
      detectInstallMode({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        standalone: isStandalone(),
        hasPrompt: !!window.__deferredInstall,
      }),
    );
  }, []);

  useEffect(() => {
    refresh();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__deferredInstall = e as BeforeInstallPromptEvent;
      refresh();
    };
    const onInstalled = () => {
      window.__deferredInstall = null;
      setOpen(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Балончето се появява с малко закъснение и само ако не е затваряно скоро.
    const timer = window.setTimeout(() => {
      if (!isBubbleSnoozed(readDismissed())) setOpen(true);
    }, 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* без запазване — балончето просто може да се покаже отново */
    }
  };

  const install = async () => {
    const deferred = window.__deferredInstall;
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    window.__deferredInstall = null;
    if (outcome === "accepted") {
      setOpen(false);
      setInstalled(true);
      return;
    }
    dismiss();
    refresh();
  };

  // Само на мобилни и само ако още не е инсталирано.
  if (installed || mode === null || mode === "installed") return null;

  return (
    <div className="relative md:hidden print:hidden">
      <button
        type="button"
        onClick={() => (mode === "prompt" && !open ? void install() : setOpen((v) => !v))}
        aria-label="Инсталирай приложението на началния екран"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="status"
          className="absolute right-0 top-full z-50 mt-3 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground shadow-xl"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-2.5 h-3 w-3 rotate-45 border-l border-t border-border bg-card"
          />
          <button
            type="button"
            onClick={dismiss}
            aria-label="Затвори"
            className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <p className="pr-5 font-medium">Инсталиране на приложението на началния ви екран</p>
          {mode === "prompt" && (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Инсталирай
            </button>
          )}
          {mode === "ios" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Натиснете{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />{" "}
              <strong>Сподели</strong> в долната лента на Safari, след това{" "}
              <strong>„Добави към началния екран“</strong>.
            </p>
          )}
          {mode === "manual" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Отворете менюто на браузъра (⋮) и изберете{" "}
              <strong>„Инсталиране на приложението“</strong> или{" "}
              <strong>„Добавяне към началния екран“</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
