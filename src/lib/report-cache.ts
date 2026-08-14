/**
 * Правила за кеширане на категориите от доклада.
 *
 * Стойност в дни:
 *   null → никога не изтича (перманентен кеш)
 *   0    → никога не се кешира (винаги свежо генериране)
 */
export const CATEGORY_TTL_DAYS: Record<string, number | null> = {
  basic: null,
  vik: 365,
  ethnos: 365,
  transport: 365,
  power: 365,
  security: 30,
  services: 365,
  connectivity: 365,
  industry: 180,
  social: 7,
  culture: 180,
  media: 7,
  risks: 180,
  environment: 365,
  "onsite-checklist": null,
};

/**
 * Части, които НЕ се кешират заедно с категорията, защото зависят от
 * избраната от потребителя „Настояща локация“ или трябва да са винаги свежи.
 */
export const LIVE_PARTS: Record<string, string[]> = {
  // разстояние/време до настоящата локация се смята при всяка заявка
  basic: ["distance-to-current"],
  // връзка/маршрут до настоящата локация
  transport: ["route-to-current"],
  // раздел „новини/аварии“ винаги свеж
  power: ["outage-news"],
};

/** Категории, за които събираме линкове към пълните статии. */
export const SOURCE_LINK_CATEGORIES = ["security", "media", "social", "news"];

export type SourceLink = { label: string; url: string };

import type { Json } from "@/integrations/supabase/types";

export type CachedCategory = {
  ekatte: number;
  categoryId: string;
  data: Json;
  sourceLinks: SourceLink[] | null;
  incidentCount: number | null;
  cachedAt: string;
  expiresAt: string | null;
};

export function ttlDaysFor(categoryId: string): number | null {
  return categoryId in CATEGORY_TTL_DAYS ? CATEGORY_TTL_DAYS[categoryId]! : 30;
}

/** Изчислява expires_at спрямо правилата. `undefined` = изобщо не кеширай. */
export function expiresAtFor(categoryId: string, from = new Date()): string | null | undefined {
  const ttl = ttlDaysFor(categoryId);
  if (ttl === null) return null;
  if (ttl === 0) return undefined;
  return new Date(from.getTime() + ttl * 86_400_000).toISOString();
}

export function isFresh(expiresAt: string | null | undefined): boolean {
  if (expiresAt === null) return true;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}
