import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { detectInstallMode, isBubbleSnoozed, isIosDevice } from "../src/lib/pwa";

const PUBLIC = join(import.meta.dir, "..", "public");

/** Размери и тип на цвета от заглавната част на PNG файл. */
function pngInfo(file: string) {
  const buf = readFileSync(join(PUBLIC, file));
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25]! };
}

type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };
const manifest = JSON.parse(readFileSync(join(PUBLIC, "site.webmanifest"), "utf8")) as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  icons: ManifestIcon[];
  shortcuts?: { url: string; icons?: ManifestIcon[] }[];
};

describe("манифест и икони", () => {
  test("задължителните полета за инсталиране са налични", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  test("всяка икона от манифеста съществува и е с декларирания размер", () => {
    const all = [...manifest.icons, ...(manifest.shortcuts ?? []).flatMap((s) => s.icons ?? [])];
    for (const icon of all) {
      const file = icon.src.replace(/^\//, "");
      expect(existsSync(join(PUBLIC, file))).toBe(true);
      const [w, h] = icon.sizes.split("x").map(Number);
      const info = pngInfo(file);
      expect([info.width, info.height]).toEqual([w!, h!]);
    }
  });

  test("има икони 192 и 512 за обикновена и за „maskable“ употреба", () => {
    for (const purpose of ["any", "maskable"]) {
      for (const size of ["192x192", "512x512"]) {
        expect(manifest.icons.some((i) => i.purpose === purpose && i.sizes === size)).toBe(true);
      }
    }
  });

  test("„maskable“ иконите и apple-touch-icon са без прозрачност (плътен фон)", () => {
    for (const file of ["icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      expect(pngInfo(file).colorType).toBe(2); // RGB, без алфа канал
    }
    expect(pngInfo("apple-touch-icon.png")).toMatchObject({ width: 180, height: 180 });
  });

  test("favicon-ите и страницата за липса на връзка съществуват", () => {
    expect(pngInfo("favicon-16x16.png")).toMatchObject({ width: 16, height: 16 });
    expect(pngInfo("favicon-32x32.png")).toMatchObject({ width: 32, height: 32 });
    for (const f of ["favicon.ico", "offline.html", "sw.js", "og-image.jpg"]) {
      expect(existsSync(join(PUBLIC, f))).toBe(true);
    }
  });

  test("всички икони, на които се позовава корената на приложението, съществуват", () => {
    const root = readFileSync(join(import.meta.dir, "..", "src", "routes", "__root.tsx"), "utf8");
    const hrefs = [...root.matchAll(/href: "(\/[^"]+\.(?:png|ico|webmanifest))"/g)].map(
      (m) => m[1]!,
    );
    expect(hrefs.length).toBeGreaterThan(4);
    for (const href of hrefs) expect(existsSync(join(PUBLIC, href))).toBe(true);
  });

  test("service worker не кешира страници и сървърни заявки", () => {
    const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");
    expect(sw).toContain('request.method !== "GET"');
    expect(sw).toContain("/_serverFn");
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain("/offline.html");
  });
});

describe("режим на инсталиране", () => {
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile Safari/537.36";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/605.1.15";

  test("вече инсталирано → нищо не се показва", () => {
    expect(detectInstallMode({ userAgent: ANDROID, standalone: true, hasPrompt: true })).toBe(
      "installed",
    );
  });

  test("Chrome на Android със системен диалог", () => {
    expect(detectInstallMode({ userAgent: ANDROID, standalone: false, hasPrompt: true })).toBe(
      "prompt",
    );
  });

  test("iPhone и iPad → ръчни стъпки; други браузъри → общи стъпки", () => {
    expect(detectInstallMode({ userAgent: IPHONE, standalone: false, hasPrompt: false })).toBe(
      "ios",
    );
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 0)).toBe(false);
    expect(detectInstallMode({ userAgent: ANDROID, standalone: false, hasPrompt: false })).toBe(
      "manual",
    );
  });

  test("балончето се скрива за 14 дни след затваряне", () => {
    const now = Date.now();
    expect(isBubbleSnoozed(null, now)).toBe(false);
    expect(isBubbleSnoozed(now - 3 * 86_400_000, now)).toBe(true);
    expect(isBubbleSnoozed(now - 15 * 86_400_000, now)).toBe(false);
  });
});
