/**
 * Планове и ограничения.
 *
 * Засега има само две роли: администратор (без ограничения и с всички функции)
 * и всички останали. Когато се оформи безплатният/платеният план, промените
 * се правят само тук. Докладите на неадминистраторите се ограничават с кредити, които
 * администраторът зарежда ръчно (страница „Админ“) — вж. `quota.server.ts`.
 */

type ProfileLike = { is_admin?: boolean | null; is_approved?: boolean | null } | null | undefined;

/** Платени функции: настояща локация, печат/PDF. Засега — само администратор (целта е отделно: `canUsePurpose`). */
export function isPremium(profile: ProfileLike): boolean {
  return profile?.is_admin === true;
}

/** Оценка по цел (цел на търсенето): за всички одобрени потребители, засега без допълнително ограничение. */
export function canUsePurpose(profile: ProfileLike): boolean {
  return profile?.is_approved === true || profile?.is_admin === true;
}
