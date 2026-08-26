import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { isJorfUrl } from "../jorf/client.ts";
import { RequestBudget } from "../jorf/limiter.ts";

describe("isJorfUrl", () => {
  test("accepts the JORFSearch origin", () => {
    assert.equal(
      isJorfUrl("https://jorfsearch.steinertriples.ch/name/Jean%20Dupont"),
      true,
    );
  });

  test("rejects another host", () => {
    // The people lookup re-requests a URL taken from the upstream response, so
    // without this check the upstream chooses which host we call.
    assert.equal(isJorfUrl("https://evil.example/name/x"), false);
    assert.equal(
      isJorfUrl("https://jorfsearch.steinertriples.ch.evil.example/x"),
      false,
    );
  });

  test("rejects a non-https scheme", () => {
    assert.equal(isJorfUrl("http://jorfsearch.steinertriples.ch/x"), false);
    assert.equal(isJorfUrl("file:///etc/passwd"), false);
  });

  test("rejects an unparseable value", () => {
    assert.equal(isJorfUrl("http://"), false);
  });
});

describe("RequestBudget", () => {
  test("allows requests up to the limit", () => {
    const budget = new RequestBudget(3, 1000, () => 0);
    assert.equal(budget.tryConsume(), true);
    assert.equal(budget.tryConsume(), true);
    assert.equal(budget.tryConsume(), true);
    assert.equal(budget.tryConsume(), false);
    assert.equal(budget.remaining, 0);
  });

  test("resets when the window rolls over", () => {
    let now = 0;
    const budget = new RequestBudget(2, 1000, () => now);
    budget.tryConsume();
    budget.tryConsume();
    assert.equal(budget.tryConsume(), false);

    now = 1000;
    assert.equal(budget.tryConsume(), true);
    assert.equal(budget.used, 1);
  });
});
