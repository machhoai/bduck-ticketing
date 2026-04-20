/**
 * Localization helper for products and product groups.
 *
 * Fallback chain:
 *   locales[locale] → locales["vi"] → fallback (original `name`/`description`)
 *
 * This ensures:
 *  - Existing products (no `nameLocales`) always show their `name` unchanged
 *  - New products with only VI translation show VI on all locales until EN is added
 *  - New products with both VI+EN show correct language per locale
 *
 * @param fallback   The base string (product.name / product.description)
 * @param locales    Optional locale map from Firestore (nameLocales / descriptionLocales)
 * @param locale     Current user locale (e.g. "vi", "en")
 */
export function localizeField(
  fallback: string,
  locales: Record<string, string> | undefined,
  locale: string
): string {
  if (!locales) return fallback;
  return locales[locale] || locales["vi"] || fallback;
}
