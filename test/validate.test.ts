import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  isValidFunctionTag,
  isValidPersonName,
  isValidWikidataId,
  parseBooleanParam,
} from "../validate.ts";

describe("parseBooleanParam", () => {
  test("keeps the default when the parameter is absent", () => {
    assert.equal(parseBooleanParam(undefined, true), true);
  });

  test("keeps the default when the value is empty", () => {
    // `?verify=` used to read as false and skip the JORFSearch check that
    // canonicalises the label before it reaches the page and the SVG overlay.
    assert.equal(parseBooleanParam("", true), true);
  });

  test("turns the flag off only on an explicit false", () => {
    assert.equal(parseBooleanParam("false", true), false);
    assert.equal(parseBooleanParam("0", true), false);
    assert.equal(parseBooleanParam("FALSE", true), false);
  });

  test("accepts an explicit true", () => {
    assert.equal(parseBooleanParam("true", false), true);
    assert.equal(parseBooleanParam("1", false), true);
  });

  test("keeps the default on an unrecognised value", () => {
    assert.equal(parseBooleanParam("yes", true), true);
    assert.equal(parseBooleanParam("no", true), true);
  });

  test("keeps the default when the value is repeated into an array", () => {
    // Express parses `?verify=a&verify=b` into an array.
    assert.equal(parseBooleanParam(["false", "true"], true), true);
  });
});

describe("isValidPersonName", () => {
  test("accepts a two-word name", () => {
    assert.equal(isValidPersonName("Jean Dupont"), true);
  });

  test("accepts accents, hyphens and apostrophes", () => {
    assert.equal(isValidPersonName("Élisabeth Borne"), true);
    assert.equal(isValidPersonName("Jean-Pierre Chevènement"), true);
    assert.equal(isValidPersonName("Marie d'Arc"), true);
  });

  test("accepts a decomposed name, where diacritics are separate marks", () => {
    assert.equal(isValidPersonName("Elisabeth Borne".normalize("NFD")), true);
  });

  test("rejects a single word", () => {
    assert.equal(isValidPersonName("Dupont"), false);
  });

  test("rejects markup characters", () => {
    assert.equal(isValidPersonName("<img src=x> Dupont"), false);
    assert.equal(isValidPersonName("a</text><b Dupont"), false);
  });

  test("rejects an over-long value", () => {
    assert.equal(isValidPersonName("Jean " + "a".repeat(200)), false);
  });
});

describe("isValidWikidataId", () => {
  test("accepts an entity id", () => {
    assert.equal(isValidWikidataId("Q643290"), true);
  });

  test("rejects anything else", () => {
    assert.equal(isValidWikidataId("Q0"), false);
    assert.equal(isValidWikidataId("q643290"), false);
    assert.equal(isValidWikidataId("Q643290; DROP"), false);
    assert.equal(isValidWikidataId("643290"), false);
  });
});

describe("isValidFunctionTag", () => {
  test("accepts a JORFSearch tag", () => {
    assert.equal(isValidFunctionTag("membre_gouvernement"), true);
    assert.equal(isValidFunctionTag("sous-prefet"), true);
  });

  test("rejects path traversal and separators", () => {
    assert.equal(isValidFunctionTag("../etc/passwd"), false);
    assert.equal(isValidFunctionTag("ministre?x=1"), false);
    assert.equal(isValidFunctionTag(""), false);
  });
});
