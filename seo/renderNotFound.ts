import { escapeHtmlText } from "../escape.ts";

/**
 * A real 404 page.
 *
 * Redirecting an unknown person to the home page would answer 200 for a URL
 * that has no content, which search engines record as a soft 404 and hold
 * against the whole site.
 */
export function renderNotFound(name?: string): string {
  const lead =
    name === undefined
      ? "Cette page n'existe pas."
      : `Aucune publication au Journal officiel n'a été trouvée pour « ${escapeHtmlText(name)} ».`;

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page introuvable | JOEL</title>
    <meta name="robots" content="noindex, follow" />
    <link rel="stylesheet" href="/_assets/person.css" />
  </head>
  <body>
    <main class="person">
      <h1>Page introuvable</h1>
      <p class="person__summary">${lead}</p>
      <p>
        Une personne n'apparaît sur JOEL que si elle a été citée au Journal
        officiel depuis 1990. Vérifiez l'orthographe du nom, ou repartez de
        l'accueil.
      </p>
      <ul class="person__list">
        <li><a href="https://www.joel-officiel.fr/">Accueil</a></li>
        <li><a href="/personnes">Toutes les personnes</a></li>
      </ul>
    </main>
  </body>
</html>
`;
}
