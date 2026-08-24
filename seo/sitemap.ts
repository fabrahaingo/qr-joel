import { callJORFSearchTag } from "../JORFSearch.utils.ts";
import { escapeHtmlText } from "../escape.ts";
import { isPlausiblePersonName } from "./person.ts";
import { slugifyPersonName } from "./slug.ts";

/**
 * The people offered to search engines.
 *
 * Built from the JORFSearch tag endpoints rather than the 2.4 GB bulk dump:
 * the tags that define the indexable tier total a few tens of megabytes and
 * answer directly, so the whole index is six upstream requests a day.
 *
 * Membership here must agree with `indexTier`, which decides the robots
 * directive on the page itself. A person listed here but marked noindex is a
 * contradiction search engines will hold against the site.
 */

/** Tags whose holders are public figures by virtue of the office. */
const SITEMAP_TAGS = [
  "ministre",
  "membre_gouvernement",
  "prefet",
  "ambassadeur",
  "president",
  "parlement",
] as const;

/** Sitemaps cap at 50 000 URLs; stay clear of the edge. */
const MAX_URLS_PER_CHUNK = 45_000;

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SitemapEntry {
  slug: string;
  /** Most recent publication date, used verbatim as `lastmod`. */
  lastmod?: string;
}

interface Index {
  entries: SitemapEntry[];
  builtAt: number;
}

let index: Index | null = null;
let building: Promise<Index> | null = null;

async function build(): Promise<Index> {
  const bySlug = new Map<string, SitemapEntry>();

  for (const tag of SITEMAP_TAGS) {
    const records = await callJORFSearchTag(tag);
    for (const record of records) {
      if (!isPlausiblePersonName(record.prenom, record.nom)) continue;
      const slug = slugifyPersonName(record.prenom, record.nom);
      const existing = bySlug.get(slug);
      const date = record.source_date;
      if (existing === undefined) {
        bySlug.set(slug, { slug, lastmod: date });
      } else if (
        date !== undefined &&
        (existing.lastmod === undefined || date > existing.lastmod)
      ) {
        existing.lastmod = date;
      }
    }
  }

  const entries = [...bySlug.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );
  return { entries, builtAt: Date.now() };
}

/**
 * The current index, rebuilding at most once a day.
 *
 * A stale index keeps being served while a rebuild runs, and a failed rebuild
 * leaves the previous one in place: this is historical data, so staleness is
 * never a reason to serve nothing.
 */
export async function getIndex(): Promise<Index> {
  if (index !== null && Date.now() - index.builtAt < REFRESH_INTERVAL_MS) {
    return index;
  }
  building ??= build()
    .then((built) => {
      index = built;
      return built;
    })
    .finally(() => {
      building = null;
    });

  if (index !== null) return index; // serve the stale copy while rebuilding
  return building;
}

export function chunkCount(entries: SitemapEntry[]): number {
  return Math.max(1, Math.ceil(entries.length / MAX_URLS_PER_CHUNK));
}

export function chunkFor(entries: SitemapEntry[], n: number): SitemapEntry[] {
  return entries.slice((n - 1) * MAX_URLS_PER_CHUNK, n * MAX_URLS_PER_CHUNK);
}

/** Sitemap index pointing at each chunk. */
export function renderSitemapIndex(origin: string, chunks: number): string {
  const items = Array.from(
    { length: chunks },
    (_unused, i) =>
      `  <sitemap><loc>${escapeHtmlText(origin)}/sitemap-personnes-${String(i + 1)}.xml</loc></sitemap>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>
`;
}

/** One chunk of person URLs. */
export function renderSitemapChunk(
  origin: string,
  entries: SitemapEntry[],
): string {
  const items = entries
    .map((entry) => {
      const loc = `${escapeHtmlText(origin)}/personne/${escapeHtmlText(entry.slug)}`;
      const lastmod =
        entry.lastmod === undefined
          ? ""
          : `<lastmod>${escapeHtmlText(entry.lastmod)}</lastmod>`;
      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

export { MAX_URLS_PER_CHUNK, SITEMAP_TAGS };
