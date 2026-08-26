import { escapeHtmlAttr, escapeHtmlText } from "../escape.ts";
import { buildDescription, buildTitle } from "./head.ts";
import { buildPersonJsonLd } from "./jsonld.ts";
import {
  buildSummary,
  formatFrenchDate,
  legifranceUrl,
  typeOrdreLabel,
} from "./person.ts";
import type { PersonProfile } from "./person.ts";
import { robotsDirective } from "./tier.ts";
import type { IndexTier } from "./tier.ts";

export interface RenderOptions {
  profile: PersonProfile;
  canonicalUrl: string;
  tier: IndexTier;
  /** Markup for the messenger buttons, already assembled by the caller. */
  followBlock: string;
  /** Absolute URL of the QR image, omitted on small screens. */
  qrImageUrl?: string;
  umamiScript?: string;
}

const t = escapeHtmlText;
const a = escapeHtmlAttr;

function renderTimeline(profile: PersonProfile): string {
  return profile.records
    .map((record) => {
      const parts: string[] = [];
      if (record.source_date !== undefined) {
        parts.push(
          `<time datetime="${a(record.source_date)}">${t(formatFrenchDate(record.source_date))}</time>`,
        );
      }
      parts.push(
        `<span class="timeline__what">${t(typeOrdreLabel(record.type_ordre))}</span>`,
      );

      const detail: string[] = [];
      if (record.grade !== undefined) detail.push(t(record.grade));
      if (record.grade_precedent !== undefined) {
        detail.push(`précédemment ${t(record.grade_precedent)}`);
      }
      for (const organisation of record.organisations ?? []) {
        detail.push(t(organisation.nom));
      }
      if (record.nomme_par !== undefined) {
        detail.push(`nommé(e) par ${t(record.nomme_par)}`);
      }
      if (detail.length > 0) {
        parts.push(`<p class="timeline__detail">${detail.join(" — ")}</p>`);
      }

      if (record.source_id !== undefined) {
        parts.push(
          `<p class="timeline__source"><a href="${a(legifranceUrl(record.source_id))}" rel="noopener">Voir le texte au Journal officiel</a></p>`,
        );
      }
      return `<li>${parts.join("\n          ")}</li>`;
    })
    .join("\n        ");
}

function renderFacts(profile: PersonProfile): string {
  const facts: [string, string][] = [
    ["Publications", String(profile.records.length)],
  ];
  if (profile.firstDate !== undefined) {
    facts.push(["Première publication", formatFrenchDate(profile.firstDate)]);
  }
  if (profile.lastDate !== undefined) {
    facts.push(["Dernière publication", formatFrenchDate(profile.lastDate)]);
  }
  if (profile.organisations.length > 0) {
    facts.push(["Organisations", String(profile.organisations.length)]);
  }
  if (profile.latestGrade !== undefined) {
    facts.push(["Dernière qualité", profile.latestGrade]);
  }
  return facts
    .map(
      ([label, value]) => `<div><dt>${t(label)}</dt><dd>${t(value)}</dd></div>`,
    )
    .join("\n          ");
}

function renderOrganisations(profile: PersonProfile): string {
  if (profile.organisations.length === 0) return "";
  const items = profile.organisations
    .map((organisation) => {
      const label = t(organisation.nom);
      return organisation.wikidata_id === undefined
        ? `<li>${label}</li>`
        : `<li><a href="https://www.wikidata.org/wiki/${a(organisation.wikidata_id)}" rel="noopener">${label}</a></li>`;
    })
    .join("\n          ");
  return `
      <h2>Organisations mentionnées</h2>
      <ul class="person__list">
          ${items}
      </ul>`;
}

/** Full HTML document for a person page. */
export function renderPersonPage(options: RenderOptions): string {
  const { profile, canonicalUrl, tier, followBlock, qrImageUrl, umamiScript } =
    options;

  const title = buildTitle(profile.displayName);
  const description = buildDescription(profile);
  const jsonLd = buildPersonJsonLd(profile, canonicalUrl);
  const ogImage = `${canonicalUrl}/og.png`;

  const qrBlock =
    qrImageUrl === undefined
      ? ""
      : `<p><img src="${a(qrImageUrl)}" alt="QR code vers cette page" width="300" height="300" loading="lazy" /></p>`;

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t(title)}</title>
    <meta name="description" content="${a(description)}" />
    <meta name="robots" content="${a(robotsDirective(tier))}" />
    <link rel="canonical" href="${a(canonicalUrl)}" />

    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${a(canonicalUrl)}" />
    <meta property="og:title" content="${a(title)}" />
    <meta property="og:description" content="${a(description)}" />
    <meta property="og:image" content="${a(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:site_name" content="JOEL" />
    <meta property="profile:first_name" content="${a(profile.prenom)}" />
    <meta property="profile:last_name" content="${a(profile.nom)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${a(title)}" />
    <meta name="twitter:description" content="${a(description)}" />
    <meta name="twitter:image" content="${a(ogImage)}" />

    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="stylesheet" href="/_assets/person.css" />
    ${umamiScript ?? ""}
    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <main class="person">
      <nav class="person__breadcrumb" aria-label="Fil d'ariane">
        <ol>
          <li><a href="https://www.joel-officiel.fr/">Accueil</a></li>
          <li><a href="/personnes">Personnes</a></li>
          <li aria-current="page">${t(profile.displayName)}</li>
        </ol>
      </nav>

      <h1>${t(profile.displayName)} — nominations au Journal officiel</h1>

      <p class="person__summary">${t(buildSummary(profile))}</p>

      <dl class="person__facts">
          ${renderFacts(profile)}
      </dl>

      <h2>Parcours au Journal officiel</h2>
      <ol class="timeline">
        ${renderTimeline(profile)}
      </ol>
${renderOrganisations(profile)}

      <section class="person__follow">
        <h2>Suivre ${t(profile.displayName)}</h2>
        <p>Recevez une alerte dès que cette personne est citée au Journal officiel.</p>
        ${followBlock}
        ${qrBlock}
      </section>

      <footer class="person__source">
        <p>
          Source : <a href="https://jorfsearch.steinertriples.ch/name/${a(profile.displayName)}" rel="noopener">JORFSearch</a>,
          d'après le Journal officiel de la République française publié sur
          <a href="https://www.legifrance.gouv.fr/" rel="noopener">Légifrance</a>.
        </p>
        <p>
          Les publications sont regroupées par nom, tel que publié au Journal
          officiel : un même nom peut correspondre à plusieurs personnes.
        </p>
        <p>
          <a href="https://www.joel-officiel.fr/a-propos-des-donnees.html">Origine des données, correction et opposition</a>
        </p>
      </footer>
    </main>
  </body>
</html>
`;
}
