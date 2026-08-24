/** Input validation for query parameters, applied before any other processing. */

/** Longest accepted person name, in characters. */
export const MAX_NAME_LENGTH = 120;

/** Longest accepted function tag, in characters. */
export const MAX_TAG_LENGTH = 64;

const WIKIDATA_ID = /^Q[1-9][0-9]*$/;

/**
 * Letters, marks, digits, space, hyphen, apostrophe and dot.
 *
 * Marks (`\p{M}`) must be allowed because a name in NFD form carries its
 * diacritics as separate combining characters.
 */
const NAME_ALLOWED = /^[\p{L}\p{M}\p{N} \-'’.]+$/u;

/**
 * Read a boolean query parameter.
 *
 * Only the explicit strings `false` and `0` turn the flag off. Anything else,
 * including an empty value, keeps the default, so `?verify=` cannot silently
 * disable a check that guards later processing.
 */
export function parseBooleanParam(
  raw: unknown,
  defaultValue: boolean,
): boolean {
  if (typeof raw !== "string") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return defaultValue;
}

/** A person name of at least two words, within the allowed character set. */
export function isValidPersonName(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > MAX_NAME_LENGTH) return false;
  if (!NAME_ALLOWED.test(v)) return false;
  return v.split(/\s+/).filter(Boolean).length >= 2;
}

/** A Wikidata entity id, such as `Q643290`. */
export function isValidWikidataId(value: string): boolean {
  return WIKIDATA_ID.test(value);
}

/** A JORFSearch function tag: lowercase word characters and hyphens. */
export function isValidFunctionTag(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_TAG_LENGTH &&
    /^[a-z0-9_-]+$/.test(value)
  );
}

/**
 * A single string value for a query parameter.
 *
 * Express parses a repeated parameter into an array and a bracketed one into
 * an object, so a parameter cannot be assumed to be a string.
 */
export function singleQueryValue(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

/** A positive integer query parameter, clamped to a range. */
export function parsePageParam(raw: unknown, max: number): number {
  const value = singleQueryValue(raw);
  const parsed = value === undefined ? 1 : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(1, parsed), Math.max(1, max));
}
