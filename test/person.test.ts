import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { JORFSearchItem } from "../JORFSearch.utils.ts";
import {
  buildProfile,
  buildSummary,
  formatFrenchDate,
  isPlausiblePersonName,
  typeOrdreLabel,
} from "../seo/person.ts";
import {
  buildDescription,
  buildTitle,
  DESCRIPTION_MAX,
  TITLE_MAX,
} from "../seo/head.ts";
import { buildPersonJsonLd } from "../seo/jsonld.ts";

function record(extra: Partial<JORFSearchItem> = {}): JORFSearchItem {
  return {
    prenom: "Élisabeth",
    nom: "Borne",
    sexe: "F",
    source_date: "2025-11-14",
    source_id: "JORFTEXT000052573206",
    source_name: "JORF",
    type_ordre: "nomination",
    ...extra,
  };
}

const PAGE_URL = "https://www.joel-officiel.fr/personne/elisabeth-borne";

interface GraphNode {
  "@type": string;
  [key: string]: unknown;
}

/** Parse the rendered graph and pull out one node by its type. */
function node(json: string, type: string): GraphNode {
  const graph = JSON.parse(json) as { "@graph": GraphNode[] };
  const found = graph["@graph"].find((n) => n["@type"] === type);
  assert.ok(found, `no ${type} node in graph`);
  return found;
}

describe("formatFrenchDate", () => {
  test("formats a date in French", () => {
    assert.equal(formatFrenchDate("2025-11-14"), "14 novembre 2025");
  });

  test("uses the ordinal form for the first of the month", () => {
    assert.equal(formatFrenchDate("2025-08-01"), "1er août 2025");
  });

  test("passes an unrecognised value through", () => {
    assert.equal(formatFrenchDate("not-a-date"), "not-a-date");
  });
});

describe("typeOrdreLabel", () => {
  test("maps known values", () => {
    assert.equal(typeOrdreLabel("nomination"), "Nomination");
    assert.equal(
      typeOrdreLabel("cessation de fonction"),
      "Cessation de fonctions",
    );
  });

  test("has a label when the field is absent", () => {
    assert.equal(typeOrdreLabel(undefined), "Publication");
  });

  test("capitalises an unknown value rather than dropping it", () => {
    assert.equal(typeOrdreLabel("mutation"), "Mutation");
  });
});

describe("buildProfile", () => {
  test("returns null for an empty history", () => {
    assert.equal(buildProfile([]), null);
  });

  test("orders records newest first and spans the date range", () => {
    const profile = buildProfile([
      record({ source_date: "2015-05-22" }),
      record({ source_date: "2025-11-14" }),
      record({ source_date: "2020-01-02" }),
    ]);
    assert.ok(profile);
    assert.equal(profile.records[0].source_date, "2025-11-14");
    assert.ok(profile);
    assert.equal(profile.firstDate, "2015-05-22");
    assert.equal(profile.lastDate, "2025-11-14");
  });

  test("deduplicates organisations across records", () => {
    const profile = buildProfile([
      record({ organisations: [{ nom: "RATP", wikidata_id: "Q643290" }] }),
      record({ organisations: [{ nom: "RATP", wikidata_id: "Q643290" }] }),
      record({ organisations: [{ nom: "Assemblée nationale" }] }),
    ]);
    assert.equal(profile?.organisations.length, 2);
  });

  test("takes the person wikidata id, not an organisation one", () => {
    // These live in different places in the payload and conflating them would
    // link the page to the wrong entity.
    const profile = buildProfile([
      record({ organisations: [{ nom: "RATP", wikidata_id: "Q643290" }] }),
      record({ wikidata_id: "Q3579221" }),
    ]);
    assert.equal(profile?.wikidataId, "Q3579221");
  });
});

describe("buildSummary", () => {
  test("agrees in number for a single publication", () => {
    const profile = buildProfile([record()]);
    assert.ok(profile);
    const summary = buildSummary(profile);
    assert.match(summary, /1 publication au Journal officiel/);
    assert.doesNotMatch(summary, /1 publications/);
  });

  test("pluralises and states the range for several", () => {
    const profile = buildProfile([
      record({ source_date: "2015-05-22" }),
      record({ source_date: "2025-11-14" }),
    ]);
    assert.ok(profile);
    const summary = buildSummary(profile);
    assert.match(summary, /2 publications/);
    assert.match(summary, /entre le 22 mai 2015 et le 14 novembre 2025/);
  });

  test("degrades to a valid sentence with only a name and a date", () => {
    const profile = buildProfile([
      { prenom: "Jean", nom: "Dupont", source_date: "2020-03-01" },
    ]);
    assert.ok(profile);
    const summary = buildSummary(profile);
    assert.match(summary, /^Jean Dupont fait l'objet de 1 publication/);
    assert.ok(summary.endsWith("."));
  });
});

describe("buildTitle", () => {
  test("leads with the name", () => {
    assert.match(buildTitle("Élisabeth Borne"), /^Élisabeth Borne/);
  });

  test("stays within the budget even for a long name", () => {
    const long = "Marie-Charlotte de La Tour d'Auvergne-Lauraguais";
    assert.ok(
      buildTitle(long).length <= TITLE_MAX,
      `title too long: ${buildTitle(long)}`,
    );
  });

  test("falls back to the bare name when nothing else fits", () => {
    const veryLong = "A".repeat(120);
    assert.equal(buildTitle(veryLong), veryLong);
  });
});

describe("buildDescription", () => {
  test("is specific to the person rather than the site", () => {
    const profile = buildProfile([record()]);
    assert.ok(profile);
    const description = buildDescription(profile);
    assert.match(description, /Élisabeth Borne/);
    assert.ok(description.length <= DESCRIPTION_MAX);
  });

  test("truncates on a word boundary", () => {
    const profile = buildProfile([
      record({
        grade: "directrice générale adjointe chargée des affaires européennes",
        organisations: [
          {
            nom: "Ministère de la Transition écologique et de la Cohésion des territoires",
          },
        ],
      }),
    ]);
    assert.ok(profile);
    const description = buildDescription(profile);
    assert.ok(description.length <= DESCRIPTION_MAX);
    assert.doesNotMatch(description, / …$/);
  });
});

describe("buildPersonJsonLd", () => {
  test("emits valid JSON", () => {
    const profile = buildProfile([record()]);
    assert.ok(profile);
    assert.doesNotThrow(() => JSON.parse(buildPersonJsonLd(profile, PAGE_URL)));
  });

  test("cannot terminate the surrounding script element", () => {
    const profile = buildProfile([
      record({ prenom: "</script><script>alert(1)</script>", nom: "X" }),
    ]);
    assert.ok(profile);
    const json = buildPersonJsonLd(profile, PAGE_URL);
    assert.ok(!json.includes("</script>"), "raw closing tag leaked");
    assert.doesNotThrow(() => JSON.parse(json));
  });

  test("omits gender when the source does not state it", () => {
    const profile = buildProfile([record({ sexe: undefined })]);
    assert.ok(profile);
    const person = node(buildPersonJsonLd(profile, PAGE_URL), "Person");
    assert.equal("gender" in person, false);
  });

  test("does not claim a current employer after a departure", () => {
    // `worksFor` is present tense.
    const profile = buildProfile([
      record({
        type_ordre: "cessation de fonction",
        organisations: [{ nom: "RATP", wikidata_id: "Q643290" }],
      }),
    ]);
    assert.ok(profile);
    const person = node(buildPersonJsonLd(profile, PAGE_URL), "Person");
    assert.equal("worksFor" in person, false);
  });

  test("links sources to Légifrance", () => {
    const profile = buildProfile([record()]);
    assert.ok(profile);
    const person = node(buildPersonJsonLd(profile, PAGE_URL), "Person");
    const sources = person.subjectOf as { url: string }[];
    assert.match(
      sources[0].url,
      /legifrance\.gouv\.fr\/jorf\/id\/JORFTEXT000052573206/,
    );
  });

  test("wires the graph to the identifiers the site already publishes", () => {
    const profile = buildProfile([record()]);
    assert.ok(profile);
    const page = node(buildPersonJsonLd(profile, PAGE_URL), "ProfilePage");
    const publisher = page.publisher as { "@id": string };
    assert.equal(
      publisher["@id"],
      "https://www.joel-officiel.fr/#organization",
    );
  });
});

describe("isPlausiblePersonName", () => {
  test("accepts ordinary names", () => {
    assert.equal(isPlausiblePersonName("Élisabeth", "Borne"), true);
    assert.equal(isPlausiblePersonName("Jean-Pierre", "de La Tour"), true);
  });

  test("rejects the malformed records JORFSearch carries", () => {
    // Real values from the `parlement` tag, where a session year lands in
    // prenom and a whole report title lands in nom.
    assert.equal(
      isPlausiblePersonName(
        "2024-2025",
        "Agnès Canayer sur la proposition de loi organique n° 636 rect. bis",
      ),
      false,
    );
    assert.equal(
      isPlausiblePersonName(
        "A.N",
        "Hervé Reynaud sur la proposition de loi n° 2180",
      ),
      false,
    );
  });

  test("rejects empty or missing parts", () => {
    assert.equal(isPlausiblePersonName(undefined, "Borne"), false);
    assert.equal(isPlausiblePersonName("", "Borne"), false);
    assert.equal(isPlausiblePersonName("Élisabeth", "   "), false);
  });

  test("rejects a name carrying digits", () => {
    assert.equal(isPlausiblePersonName("Jean2", "Dupont"), false);
  });
});
