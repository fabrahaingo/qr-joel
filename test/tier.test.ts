import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { JORFSearchItem } from "../JORFSearch.utils.ts";
import {
  indexTier,
  isIndexable,
  NEVER_INDEX_FIELDS,
  PUBLIC_OFFICE_FIELDS,
  robotsDirective,
} from "../seo/tier.ts";

function record(extra: Record<string, unknown>): JORFSearchItem {
  return {
    prenom: "Jean",
    nom: "Dupont",
    source_date: "2025-01-01",
    ...extra,
  };
}

describe("indexTier", () => {
  test("a public office makes the page indexable", () => {
    for (const field of PUBLIC_OFFICE_FIELDS) {
      assert.equal(
        indexTier([record({ [field]: true })]),
        "public-office",
        `${field} should qualify`,
      );
    }
  });

  test("a decoration alone never makes a page indexable", () => {
    // Decorations look like notability and are not: they are personal honours
    // frequently awarded to private citizens holding no public office.
    for (const field of NEVER_INDEX_FIELDS) {
      assert.equal(
        indexTier([record({ [field]: true })]),
        "restricted",
        `${field} must not qualify`,
      );
    }
  });

  test("the two lists never overlap", () => {
    const office = new Set<string>(PUBLIC_OFFICE_FIELDS);
    for (const field of NEVER_INDEX_FIELDS) {
      assert.ok(!office.has(field), `${field} appears in both lists`);
    }
  });

  test("a plain record is restricted", () => {
    assert.equal(indexTier([record({})]), "restricted");
  });

  test("an empty history is restricted", () => {
    assert.equal(indexTier([]), "restricted");
  });

  test("one qualifying record among many is enough", () => {
    assert.equal(
      indexTier([record({}), record({ prefet: true }), record({})]),
      "public-office",
    );
  });

  test("a falsy field value does not qualify", () => {
    assert.equal(indexTier([record({ ministre: false })]), "restricted");
    assert.equal(indexTier([record({ ministre: "" })]), "restricted");
    assert.equal(indexTier([record({ ministre: "false" })]), "restricted");
  });

  test("a string office value qualifies", () => {
    assert.equal(
      indexTier([record({ prefet_departement: "75", prefet: "true" })]),
      "public-office",
    );
  });
});

describe("robotsDirective", () => {
  test("only the public office tier is indexable", () => {
    assert.match(robotsDirective("public-office"), /^index, follow/);
    assert.match(robotsDirective("restricted"), /noindex/);
    assert.match(robotsDirective("restricted"), /noarchive/);
  });

  test("restricted pages still allow crawling onwards", () => {
    // `follow` keeps the internal link graph traversable even where the page
    // itself is not indexed.
    assert.match(robotsDirective("restricted"), /follow/);
  });

  test("isIndexable agrees with the directive", () => {
    assert.equal(isIndexable("public-office"), true);
    assert.equal(isIndexable("restricted"), false);
  });
});
