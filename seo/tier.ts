import type { JORFSearchItem } from "../JORFSearch.utils.ts";

/**
 * Which person pages search engines are allowed to index.
 *
 * Publishing a name page is one thing; making it findable by name is another,
 * and it is the second that carries the weight. Indexing is therefore limited
 * to people who hold or held a notable public office, where the public
 * interest in the appointment is the reason it was published at all.
 *
 * Everything else renders normally for people who follow a link, and carries
 * `noindex, noarchive`.
 */

/**
 * Offices that make someone a public figure.
 *
 * Keyed on the JORFSearch fields that mark the office. Adding to this list
 * widens who becomes searchable by name, so it is a decision to take
 * deliberately rather than a list to extend for coverage.
 */
const PUBLIC_OFFICE_FIELDS = [
  "ministre",
  "secretaire_etat",
  "membre_gouvernement",
  "conseil_des_ministres",
  "prefet",
  "prefet_region",
  "sous-prefet",
  "secretaire_general_de_prefecture",
  "ambassadeur",
  "consul",
  "president",
  "parlement",
  "commission_parlementaire",
  "delegation_parlementaire",
  "recteur_academie",
  "haut_fonctionnaire_defense",
] as const;

/**
 * Never a reason to index, whatever else the record says.
 *
 * Decorations look like notability markers and are not: they are personal
 * honours, frequently awarded to private citizens with no public office.
 * Students are at the start of a career and hold no authority. Regulated
 * professions are published appointments, but a notary is not a public figure.
 */
const NEVER_INDEX_FIELDS = [
  "legion_honneur",
  "ordre_merite",
  "ordre_nation",
  "medaille_militaire",
  "medaille_securite_interieure",
  "eleve_ena",
  "eleve_ens",
  "eleve_ira",
  "eleve_mines",
  "eleve_polytechnique",
  "eleve_ponts_et_chaussees",
  "notaire",
  "huissier",
  "commissaire_de_justice",
  "greffier",
  "avocat_aux_conseils",
] as const;

export type IndexTier = "public-office" | "restricted";

function hasField(item: JORFSearchItem, field: string): boolean {
  const value = item[field];
  if (value === undefined || value === null) return false;
  if (value === false) return false;
  if (typeof value === "string") return value.length > 0 && value !== "false";
  return true;
}

/** Whether any record for this person marks a notable public office. */
export function indexTier(records: JORFSearchItem[]): IndexTier {
  const carriesOffice = records.some((record) =>
    PUBLIC_OFFICE_FIELDS.some((field) => hasField(record, field)),
  );
  return carriesOffice ? "public-office" : "restricted";
}

/** The `robots` meta value for a tier. */
export function robotsDirective(tier: IndexTier): string {
  return tier === "public-office"
    ? "index, follow, max-snippet:-1, max-image-preview:large"
    : "noindex, noarchive, follow";
}

/** Whether a tier belongs in the sitemap. */
export function isIndexable(tier: IndexTier): boolean {
  return tier === "public-office";
}

export { NEVER_INDEX_FIELDS, PUBLIC_OFFICE_FIELDS };
