import { useCallback, useEffect, useState } from "react";

/** Любими населени места. Пазят се в браузъра (localStorage) — без акаунт и без заявки към сървъра. */

export type Favorite = { ekatte: number; label: string };

const KEY = "kadeda:favorites";
const EVENT = "kadeda:favorites-changed";
const MAX_FAVORITES = 30;

export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<number>();
    const out: Favorite[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const { ekatte, label } = item as { ekatte?: unknown; label?: unknown };
      if (typeof ekatte !== "number" || !Number.isInteger(ekatte) || seen.has(ekatte)) continue;
      if (typeof label !== "string") continue;
      seen.add(ekatte);
      out.push({ ekatte, label });
    }
    return out.slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

/** Добавя място в началото на списъка или го маха, ако вече е там. */
export function toggleFavorite(list: Favorite[], fav: Favorite): Favorite[] {
  return list.some((f) => f.ekatte === fav.ekatte)
    ? list.filter((f) => f.ekatte !== fav.ekatte)
    : [fav, ...list].slice(0, MAX_FAVORITES);
}

function read(): Favorite[] {
  try {
    return parseFavorites(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(list: Favorite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Частен режим или блокирано съхранение — любимите просто няма да се запомнят.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    const sync = () => setFavorites(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((fav: Favorite) => write(toggleFavorite(read(), fav)), []);
  const remove = useCallback(
    (ekatte: number) => write(read().filter((f) => f.ekatte !== ekatte)),
    [],
  );
  const isFavorite = useCallback(
    (ekatte: number) => favorites.some((f) => f.ekatte === ekatte),
    [favorites],
  );

  return { favorites, isFavorite, toggle, remove };
}
