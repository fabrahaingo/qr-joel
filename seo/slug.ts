import { createHash } from "node:crypto";

/**
 * URL slugs for person pages.
 *
 * Changing this function after launch changes every URL the site has ever
 * published, so it is covered by a frozen fixture in the test suite. Prefer
 * adding an alias over adjusting the algorithm.
 *
 * Deliberately separate from `cleanPeopleNameJORFURL`, which builds JORFSearch
 * query URLs and must keep sending accented text upstream.
 */

/** Longest slug before it is truncated and disambiguated by hash. */
const MAX_SLUG_LENGTH = 80;
const TRUNCATE_AT = 74;
const HASH_LENGTH = 6;

/**
 * Characters that carry no combining mark to strip, so NFD leaves them intact
 * and they would otherwise be dropped entirely.
 */
const LIGATURES: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ø: "o",
  ß: "ss",
  đ: "d",
  ł: "l",
  ð: "d",
  þ: "th",
  ħ: "h",
  ı: "i",
};

function shortHash(input: string, length: number): string {
  return createHash("sha256")
    .update(input, "utf8")
    .digest("hex")
    .slice(0, length);
}

/** Normalise a name into slug-safe ASCII words. */
function toWords(value: string): string {
  let out = value.toLowerCase();
  out = out.replace(/[æœøßđłðþħı]/g, (c) => LIGATURES[c] ?? c);
  out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Apostrophes become separators rather than vanishing, so "d'Artagnan"
  // reads as "d-artagnan" instead of "dartagnan".
  out = out.replace(/[‘’ʼ'`´]/g, "-");
  out = out.replace(/[^a-z0-9]+/g, "-");
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Build the canonical slug for a person.
 *
 * Returns a stable, lowercase, hyphen-separated value. Names that normalise to
 * nothing, such as a fully non-Latin name, fall back to a hash so every person
 * still has a usable URL.
 */
export function slugifyPersonName(prenom: string, nom: string): string {
  const full = `${prenom} ${nom}`.trim();
  const words = toWords(full);

  if (words.length === 0) return `p-${shortHash(full, 10)}`;
  if (words.length <= MAX_SLUG_LENGTH) return words;

  const cut = words.slice(0, TRUNCATE_AT);
  const stem = cut.slice(
    0,
    cut.lastIndexOf("-") > 0 ? cut.lastIndexOf("-") : cut.length,
  );
  return `${stem}-${shortHash(full, HASH_LENGTH)}`;
}

/** Append a Wikidata id to separate two people who share a name. */
export function disambiguatedSlug(slug: string, wikidataId: string): string {
  return `${slug}-${wikidataId.toLowerCase()}`;
}

/** Split a disambiguated slug back into its base and Wikidata id. */
export function parseSlug(slug: string): { base: string; wikidataId?: string } {
  const match = /^(.*)-(q[1-9][0-9]*)$/.exec(slug);
  if (match === null) return { base: slug };
  return { base: match[1], wikidataId: match[2].toUpperCase() };
}

/**
 * The canonical form of a requested slug, or null when it already is one.
 *
 * Used to redirect uppercase, padded or otherwise non-canonical spellings to a
 * single indexable URL.
 */
export function canonicaliseSlug(requested: string): string | null {
  const canonical = toWords(requested);
  return canonical === requested ? null : canonical;
}
