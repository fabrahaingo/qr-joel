import { escapeHtmlAttr, escapeHtmlText } from "../escape.ts";
import type { SitemapEntry } from "./sitemap.ts";

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

function slugToDisplay(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Letter index, the entry point crawlers follow into the person pages. */
export function renderPeopleHub(total: number): string {
  const links = LETTERS.map(
    (letter) =>
      `<li><a href="/personnes/${letter}">${letter.toUpperCase()}</a></li>`,
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Personnes citées au Journal officiel | JOEL</title>
    <meta name="description" content="Parcourez les ${String(total)} personnalités publiques citées au Journal officiel de la République française et suivies par JOEL." />
    <meta name="robots" content="index, follow" />
    <link rel="stylesheet" href="/_assets/person.css" />
  </head>
  <body>
    <main class="person">
      <nav class="person__breadcrumb" aria-label="Fil d'ariane">
        <ol>
          <li><a href="https://www.joel-officiel.fr/">Accueil</a></li>
          <li aria-current="page">Personnes</li>
        </ol>
      </nav>
      <h1>Personnes citées au Journal officiel</h1>
      <p class="person__summary">
        ${String(total)} personnalités publiques dont les nominations ont été
        publiées au Journal officiel de la République française. Choisissez une
        initiale pour parcourir la liste.
      </p>
      <ul class="person__list">
          ${links}
      </ul>
    </main>
  </body>
</html>
`;
}

/** One letter's worth of people, paginated. */
export function renderLetterPage(
  letter: string,
  entries: SitemapEntry[],
  page: number,
  pageCount: number,
): string {
  const items = entries
    .map(
      (entry) =>
        `<li><a href="/personne/${escapeHtmlAttr(entry.slug)}">${escapeHtmlText(slugToDisplay(entry.slug))}</a></li>`,
    )
    .join("\n          ");

  const nav: string[] = [];
  if (page > 1) {
    nav.push(
      `<a rel="prev" href="/personnes/${letter}${page === 2 ? "" : `?page=${String(page - 1)}`}">Page précédente</a>`,
    );
  }
  if (page < pageCount) {
    nav.push(
      `<a rel="next" href="/personnes/${letter}?page=${String(page + 1)}">Page suivante</a>`,
    );
  }

  // Pages beyond the first are crawl paths rather than landing pages, so they
  // stay followable without competing for the same query.
  const robots = page === 1 ? "index, follow" : "noindex, follow";

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Personnes en ${letter.toUpperCase()} — Journal officiel | JOEL</title>
    <meta name="description" content="Personnalités publiques dont le nom commence par ${letter.toUpperCase()}, citées au Journal officiel." />
    <meta name="robots" content="${robots}" />
    <link rel="stylesheet" href="/_assets/person.css" />
  </head>
  <body>
    <main class="person">
      <nav class="person__breadcrumb" aria-label="Fil d'ariane">
        <ol>
          <li><a href="https://www.joel-officiel.fr/">Accueil</a></li>
          <li><a href="/personnes">Personnes</a></li>
          <li aria-current="page">${letter.toUpperCase()}</li>
        </ol>
      </nav>
      <h1>Personnes en ${letter.toUpperCase()}</h1>
      <p class="person__summary">
        Page ${String(page)} sur ${String(pageCount)}.
      </p>
      <ul class="person__list">
          ${items}
      </ul>
      <p>${nav.join(" · ")}</p>
    </main>
  </body>
</html>
`;
}
