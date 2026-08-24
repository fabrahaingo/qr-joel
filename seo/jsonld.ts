import { escapeJsonLd } from "../escape.ts";
import { legifranceUrl } from "./person.ts";
import type { PersonProfile } from "./person.ts";

/**
 * Structured data for a person page.
 *
 * Only claims the records support. A property that would need a guess is left
 * out: a wrong assertion about a real person is worse than a missing one, and
 * search engines discount a source that overstates.
 */

/** Identifiers already published by the marketing site, reused verbatim. */
const SITE_ID = "https://www.joel-officiel.fr/#website";
const ORGANIZATION_ID = "https://www.joel-officiel.fr/#organization";

/** Most recent publications described as sources, capped to keep the graph small. */
const MAX_CITED_SOURCES = 10;

const CESSATION = /cessation/i;

function wikidataUrl(id: string): string {
  return `https://www.wikidata.org/wiki/${id}`;
}

export function buildPersonJsonLd(
  profile: PersonProfile,
  pageUrl: string,
): string {
  const latest = profile.records[0];

  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${pageUrl}#person`,
    name: profile.displayName,
    givenName: profile.prenom,
    familyName: profile.nom,
    url: pageUrl,
  };

  // Only the two values the source actually distinguishes.
  if (profile.sexe === "F") person.gender = "Female";
  if (profile.sexe === "M") person.gender = "Male";

  if (profile.wikidataId !== undefined) {
    person.sameAs = [wikidataUrl(profile.wikidataId)];
  }

  if (profile.latestGrade !== undefined) {
    person.jobTitle = profile.latestGrade;
    person.hasOccupation = {
      "@type": "Occupation",
      name: profile.latestGrade,
    };
  }

  // `worksFor` is present tense, so it must not survive a departure.
  const hasLeft = CESSATION.test(latest.type_ordre ?? "");
  const latestOrganisation = latest.organisations?.[0];
  if (!hasLeft && latestOrganisation !== undefined) {
    const organisation: Record<string, unknown> = {
      "@type": "Organization",
      name: latestOrganisation.nom,
    };
    if (latestOrganisation.wikidata_id !== undefined) {
      organisation.sameAs = wikidataUrl(latestOrganisation.wikidata_id);
    }
    person.worksFor = organisation;
  }

  const school = latest.ecole ?? latest.etablissement_enseignement_superieur;
  if (school !== undefined) {
    person.alumniOf = { "@type": "EducationalOrganization", name: school };
  }

  const sources = profile.records
    .filter((r) => r.source_id !== undefined && r.source_date !== undefined)
    .slice(0, MAX_CITED_SOURCES)
    .map((r) => ({
      "@type": "Legislation",
      name: `${r.source_name ?? "JORF"} ${r.source_id ?? ""}`.trim(),
      legislationIdentifier: r.source_id,
      legislationJurisdiction: "FR",
      url: legifranceUrl(r.source_id ?? ""),
      datePublished: r.source_date,
      inLanguage: "fr",
    }));
  if (sources.length > 0) person.subjectOf = sources;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${pageUrl}#profilepage`,
        url: pageUrl,
        name: `${profile.displayName} — nominations au Journal officiel`,
        inLanguage: "fr-FR",
        isPartOf: { "@id": SITE_ID },
        publisher: { "@id": ORGANIZATION_ID },
        about: { "@id": `${pageUrl}#person` },
        mainEntity: { "@id": `${pageUrl}#person` },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        ...(profile.lastDate !== undefined
          ? { dateModified: profile.lastDate }
          : {}),
      },
      person,
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: "https://www.joel-officiel.fr/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Personnes",
            item: "https://www.joel-officiel.fr/personnes",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: profile.displayName,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return escapeJsonLd(graph);
}
