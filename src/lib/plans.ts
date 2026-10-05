/**
 * Планове и ограничения.
 *
 * Засега има само две роли: администратор (без ограничения и с всички функции)
 * и всички останали. Когато се оформи безплатният/платеният план, промените
 * се правят само тук — останалият код пита `isPremium()` и `FREE_DAILY_REPORTS`.
 */

type ProfileLike = { is_admin?: boolean | null } | null | undefined;

/** Максимален брой нови доклади за 24 часа за акаунт без ограничения-права (временна стойност). */
export const FREE_DAILY_REPORTS = 3;

/** Платени функции: настояща локация, цел на търсенето, печат/PDF. Засега — само администратор. */
export function isPremium(profile: ProfileLike): boolean {
  return profile?.is_admin === true;
}
