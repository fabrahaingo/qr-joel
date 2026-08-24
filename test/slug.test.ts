import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  canonicaliseSlug,
  disambiguatedSlug,
  parseSlug,
  slugifyPersonName,
} from "../seo/slug.ts";

/**
 * Frozen expectations.
 *
 * Every published URL derives from this function, so a change here is a
 * site-wide 404. Treat a failure as a decision to migrate URLs, not as a test
 * to update.
 */
const FIXTURES: [string, string, string][] = [
  ["Jean", "Dupont", "jean-dupont"],
  ["Élisabeth", "Borne", "elisabeth-borne"],
  ["Éric", "Nuñez", "eric-nunez"],
  ["Jean-Pierre", "Chevènement", "jean-pierre-chevenement"],
  ["Marie", "de La Tour d'Auvergne", "marie-de-la-tour-d-auvergne"],
  ["Anne-Sophie", "O'Brien", "anne-sophie-o-brien"],
  ["François", "Hérisson", "francois-herisson"],
  ["Gaëlle", "Mœbius", "gaelle-moebius"],
  ["Jørgen", "Straße", "jorgen-strasse"],
  ["Nguyễn", "Văn Minh", "nguyen-van-minh"],
  ["  Jean  ", "  Dupont  ", "jean-dupont"],
  ["JEAN", "DUPONT", "jean-dupont"],
  ["Jean", "Dupont (Jr.)", "jean-dupont-jr"],
  ["Ana", "Sánchez-Íñigo", "ana-sanchez-inigo"],
];

describe("slugifyPersonName", () => {
  for (const [prenom, nom, expected] of FIXTURES) {
    test(`${prenom} ${nom} -> ${expected}`, () => {
      assert.equal(slugifyPersonName(prenom, nom), expected);
    });
  }

  test("is idempotent when fed back through itself", () => {
    for (const [prenom, nom] of FIXTURES) {
      const once = slugifyPersonName(prenom, nom);
      assert.equal(slugifyPersonName(once, ""), once);
    }
  });

  test("produces the same slug whether input is composed or decomposed", () => {
    const composed = slugifyPersonName("Élisabeth", "Borne");
    const decomposed = slugifyPersonName(
      "Élisabeth".normalize("NFD"),
      "Borne".normalize("NFD"),
    );
    assert.equal(composed, decomposed);
  });

  test("falls back to a hash for a name with no Latin characters", () => {
    const slug = slugifyPersonName("李", "明");
    assert.match(slug, /^p-[0-9a-f]{10}$/);
    assert.equal(slug, slugifyPersonName("李", "明"), "must be stable");
  });

  test("truncates a very long name and keeps it unique", () => {
    const long = "Jean ".repeat(40);
    const slug = slugifyPersonName(long, "Dupont");
    assert.ok(slug.length <= 80, `slug too long: ${String(slug.length)}`);
    assert.match(slug, /-[0-9a-f]{6}$/);
    assert.notEqual(slug, slugifyPersonName(long + "x", "Dupont"));
  });

  test("never emits leading, trailing or doubled separators", () => {
    for (const [prenom, nom] of FIXTURES) {
      const slug = slugifyPersonName(prenom, nom);
      assert.doesNotMatch(slug, /^-|-$|--/, `bad separators in ${slug}`);
    }
  });
});

describe("disambiguatedSlug and parseSlug", () => {
  test("round-trips a Wikidata id", () => {
    const slug = disambiguatedSlug("jean-dupont", "Q1234567");
    assert.equal(slug, "jean-dupont-q1234567");
    assert.deepEqual(parseSlug(slug), {
      base: "jean-dupont",
      wikidataId: "Q1234567",
    });
  });

  test("leaves an ordinary slug alone", () => {
    assert.deepEqual(parseSlug("jean-dupont"), { base: "jean-dupont" });
  });

  test("does not mistake a name ending in a q-word for an id", () => {
    assert.deepEqual(parseSlug("jean-quentin"), { base: "jean-quentin" });
  });
});

describe("canonicaliseSlug", () => {
  test("returns null when the slug is already canonical", () => {
    assert.equal(canonicaliseSlug("jean-dupont"), null);
  });

  test("returns the canonical form otherwise", () => {
    assert.equal(canonicaliseSlug("Jean-DUPONT"), "jean-dupont");
    assert.equal(canonicaliseSlug("jean--dupont"), "jean-dupont");
    assert.equal(canonicaliseSlug("-jean-dupont-"), "jean-dupont");
  });
});
