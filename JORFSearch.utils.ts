import type { InternalAxiosRequestConfig } from "axios";
import umami from "./umami.ts";
import { isJorfUrl, JORF_ORIGIN, jorfGet } from "./jorf/client.ts";
import { TtlCache } from "./jorf/cache.ts";

// Extend the InternalAxiosRequestConfig with the res field
interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  res?: {
    responseUrl?: string;
  };
}

interface JORFSearchOrganisation {
  nom: string;
  wikidata_id?: string;
}

/**
 * A single decision about one person, as published.
 *
 * Only the fields the pages actually render are declared. JORFSearch returns
 * many more, and unknown ones are preserved by the index signature so adding a
 * field here needs no change upstream.
 */
interface JORFSearchItemRaw {
  prenom?: string;
  nom?: string;
  sexe?: "F" | "M";
  source_date?: string;
  /** Légifrance identifier, for example JORFTEXT000052573206. */
  source_id?: string;
  source_name?: string;
  /** nomination, promotion, cessation de fonctions, and so on. */
  type_ordre?: string;
  organisations?: JORFSearchOrganisation[];
  wikidata_id?: string;
  nom_alternatif?: string;
  autres_prenoms?: string;
  grade?: string;
  grade_precedent?: string;
  annees_service?: string;
  date_debut?: string;
  nomme_par?: string;
  autorite_delegation?: string;
  ecole?: string;
  etablissement_enseignement_superieur?: string;
  cabinet?: string;
  parlement?: string;
  ministre?: string | boolean;
  membre_gouvernement?: string | boolean;
  conseil_des_ministres?: string | boolean;
  president?: string | boolean;
  prefet?: string | boolean;
  prefet_region?: string | boolean;
  prefet_departement?: string;
  personnalite_qualifiee?: string | boolean;
  [key: string]: unknown;
}

interface JORFSearchItem extends JORFSearchItemRaw {
  prenom: string;
  nom: string;
}

type JORFSearchResponse = null | string | JORFSearchItemRaw[];

type WikidataId = string;

interface Organisation {
  name: string;
  id: WikidataId;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Shared cache settings.
 *
 * A miss for an unknown name is remembered too, otherwise walking arbitrary
 * `name` values produces one upstream call per request.
 */
const CACHE_OPTIONS = {
  ttlMs: 6 * HOUR,
  staleMs: 7 * 24 * HOUR,
  negativeTtlMs: 1 * HOUR,
  maxEntries: 20_000,
};

const isEmptyList = (items: unknown[]): boolean => items.length === 0;

const peopleCache = new TtlCache<JORFSearchItem[]>(CACHE_OPTIONS, isEmptyList);
const tagCache = new TtlCache<JORFSearchItem[]>(CACHE_OPTIONS, isEmptyList);
const organisationCache = new TtlCache<Organisation[]>(
  CACHE_OPTIONS,
  isEmptyList,
);

export function jorfCacheStats(): Record<string, unknown> {
  return {
    people: peopleCache.stats,
    tag: tagCache.stats,
    organisation: organisationCache.stats,
  };
}

export function resetJORFCaches(): void {
  peopleCache.clear();
  tagCache.clear();
  organisationCache.clear();
}

export async function callJORFSearchPeople(
  peopleName: string,
): Promise<JORFSearchItem[]> {
  // Cleaning the string reduces the number of calls to JORFSearch, and is also
  // what makes the cache key stable across spelling variants.
  const cleaned = cleanPeopleNameJORFURL(peopleName);
  if (cleaned.length === 0) return [];

  return peopleCache.get(cleaned, async () => {
    try {
      umami.log({ event: "/jorfsearch-request-people" });
      const res1 = await jorfGet<JORFSearchResponse>(
        encodeURI(`${JORF_ORIGIN}/name/${cleaned}?format=JSON`),
      );

      if (res1.data === null) return []; // If an error occurred
      if (typeof res1.data !== "string") return cleanJORFItems(res1.data); // If it worked

      const request = res1.request as CustomInternalAxiosRequestConfig;
      const responseUrl = request.res?.responseUrl;

      // If the peopleName had nom/prenom inverted or bad formatting:
      // we need to call JORFSearch again with the response url in the correct format
      if (responseUrl === undefined || !isJorfUrl(responseUrl)) return [];

      umami.log({ event: "/jorfsearch-request-people-formatted" });
      const res2 = await jorfGet<JORFSearchResponse>(
        responseUrl.endsWith("?format=JSON")
          ? responseUrl
          : `${responseUrl}?format=JSON`,
      );
      if (res2.data === null || typeof res2.data === "string") return [];
      return cleanJORFItems(res2.data);
    } catch (error) {
      logUpstreamError("people", error);
      return [];
    }
  });
}

export async function callJORFSearchTag(
  tag: string,
  tagValue?: string,
): Promise<JORFSearchItem[]> {
  const key = tagValue === undefined ? tag : `${tag}="${tagValue}"`;

  return tagCache.get(key, async () => {
    try {
      umami.log({ event: "/jorfsearch-request-tag" });
      const res = await jorfGet<JORFSearchResponse>(
        encodeURI(`${JORF_ORIGIN}/tag/${key}?format=JSON`),
      );
      if (res.data === null || typeof res.data === "string") return [];
      return cleanJORFItems(res.data);
    } catch (error) {
      logUpstreamError("tag", error);
      return [];
    }
  });
}

export async function callJORFSearchOrganisationByWikidataId(
  wikidataId: WikidataId,
): Promise<Organisation[]> {
  return organisationCache.get(wikidataId, async () => {
    try {
      umami.log({ event: "/jorfsearch-request-organisation" });
      const res = await jorfGet<Organisation[]>(
        encodeURI(`${JORF_ORIGIN}/wikidata/contains?ids[]=${wikidataId}`),
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      logUpstreamError("organisation", error);
      return [];
    }
  });
}

export function cleanPeopleNameJORFURL(input: string): string {
  if (!input) return "";

  // 1. Trim & lowercase
  let out = input.trim().toLowerCase();

  // 2. Drop combining marks. Only decomposed input carries them, so a
  //    precomposed "é" reaches JORFSearch unchanged, which it accepts.
  out = out.replace(/[\u0300-\u036f]/g, "");

  // 3. Capitalise first letter after start, space, hyphen or apostrophe
  //    - keeps the delimiter (p1) and upper-cases the following char (p2)
  out = out.replace(/(^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase());

  out = out.replace(/[()]/g, "");

  return out;
}

function logUpstreamError(kind: string, error: unknown): void {
  umami.log({ event: "/jorfsearch-error" });
  console.error(
    `JORFSearch ${kind} request failed:`,
    error instanceof Error ? error.message : error,
  );
}

function cleanJORFItems(raw_items: JORFSearchItemRaw[]): JORFSearchItem[] {
  return raw_items.reduce((tab: JORFSearchItem[], raw_item) => {
    if (raw_item.nom != undefined && raw_item.prenom != undefined)
      tab.push(raw_item as JORFSearchItem);
    return tab;
  }, []);
}

export type {
  JORFSearchItem,
  JORFSearchOrganisation,
  Organisation,
  WikidataId,
};
