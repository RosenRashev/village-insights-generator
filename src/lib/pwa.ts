/**
 * Помощни функции за инсталиране на приложението (PWA) — чисти, за да се тестват без браузър.
 */

export type InstallMode =
  /** Вече е инсталирано/отворено като приложение — нищо не се показва. */
  | "installed"
  /** Браузърът дава системен диалог за инсталиране (Chrome/Edge/Android). */
  | "prompt"
  /** iPhone/iPad: ръчно през „Сподели → Добави към началния екран“. */
  | "ios"
  /** Други браузъри: ръчно през менюто на браузъра. */
  | "manual";

export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ се представя като Mac, но има докосване.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function detectInstallMode(opts: {
  userAgent: string;
  maxTouchPoints?: number;
  standalone: boolean;
  hasPrompt: boolean;
}): InstallMode {
  if (opts.standalone) return "installed";
  if (opts.hasPrompt) return "prompt";
  return isIosDevice(opts.userAgent, opts.maxTouchPoints ?? 0) ? "ios" : "manual";
}

/** Колко дни след затваряне на балончето не се показва отново. */
export const BUBBLE_SNOOZE_DAYS = 14;

export function isBubbleSnoozed(dismissedAt: number | null, now = Date.now()): boolean {
  if (dismissedAt === null || !Number.isFinite(dismissedAt)) return false;
  return now - dismissedAt < BUBBLE_SNOOZE_DAYS * 86_400_000;
}

/** Регистрира service worker-а (само в production и само при поддръжка). */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[pwa] service worker не се регистрира:", err);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
