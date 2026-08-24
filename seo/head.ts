import type { PersonProfile } from "./person.ts";
import { formatFrenchDate, typeOrdreLabel } from "./person.ts";

/** Google truncates around these widths, so overflow is wasted. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 165;
const DESCRIPTION_TARGET = 155;

/**
 * The longest title template that fits the budget.
 *
 * The name leads because the name is the query. "Suivre X sur JOEL" buries it
 * behind a verb nobody searches for.
 */
export function buildTitle(displayName: string): string {
  const candidates = [
    `${displayName} — nominations au Journal officiel | JOEL`,
    `${displayName} — nominations au Journal officiel`,
    `${displayName} — nominations au JO | JOEL`,
    `${displayName} — Journal officiel`,
    `${displayName} | JOEL`,
    displayName,
  ];
  return candidates.find((c) => c.length <= TITLE_MAX) ?? displayName;
}

/** Truncate on a word boundary, appending an ellipsis. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/**
 * A description built from the person's own record, never the generic site
 * copy: an identical description across pages is what makes them read as
 * duplicates.
 */
export function buildDescription(profile: PersonProfile): string {
  const count = profile.records.length;
  const plural = count > 1 ? "s" : "";
  const parts = [
    `${profile.displayName} : ${String(count)} publication${plural} au Journal officiel`,
  ];

  if (profile.firstDate !== undefined && profile.lastDate !== undefined) {
    const from = profile.firstDate.slice(0, 4);
    const to = profile.lastDate.slice(0, 4);
    parts.push(from === to ? ` en ${from}` : ` de ${from} à ${to}`);
  }
  parts.push(".");

  const latest = profile.records[0];
  const what = typeOrdreLabel(latest.type_ordre);
  const detail = profile.latestGrade ?? profile.latestOrganisation;
  if (latest.source_date !== undefined) {
    parts.push(
      detail !== undefined
        ? ` Dernière : ${what.toLowerCase()}, ${detail}, ${formatFrenchDate(latest.source_date)}.`
        : ` Dernière publication le ${formatFrenchDate(latest.source_date)}.`,
    );
  }

  const full = parts.join("");
  return full.length <= DESCRIPTION_MAX
    ? full
    : truncate(full, DESCRIPTION_TARGET);
}

export { DESCRIPTION_MAX, TITLE_MAX };
