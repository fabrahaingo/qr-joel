import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { TtlCache } from "../jorf/cache.ts";

const OPTIONS = {
  ttlMs: 1000,
  staleMs: 5000,
  negativeTtlMs: 100,
  maxEntries: 3,
};

const isEmpty = (v: string[]): boolean => v.length === 0;

/** A clock the test advances by hand, so no test waits on real time. */
function fakeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("TtlCache", () => {
  test("serves a fresh value without calling the loader again", async () => {
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);
    let calls = 0;
    const load = () => {
      calls++;
      return Promise.resolve(["a"]);
    };

    await cache.get("k", load);
    await cache.get("k", load);

    assert.equal(calls, 1);
    assert.equal(cache.stats.hits, 1);
  });

  test("coalesces concurrent misses into a single upstream call", async () => {
    // Without this, a burst of crawler requests for one page multiplies 1:1
    // into requests against JORFSearch.
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);
    let calls = 0;
    const load = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return ["a"];
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () => cache.get("k", load)),
    );

    assert.equal(calls, 1);
    assert.equal(results.length, 20);
    assert.equal(cache.stats.coalesced, 19);
  });

  test("refetches once the value is no longer fresh", async () => {
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);
    let calls = 0;
    const load = () => {
      calls++;
      return Promise.resolve(["a"]);
    };

    await cache.get("k", load);
    clock.advance(OPTIONS.ttlMs + 1);
    await cache.get("k", load);

    assert.equal(calls, 2);
  });

  test("serves a stale value immediately instead of waiting", async () => {
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);
    let calls = 0;
    const load = async () => {
      calls++;
      if (calls > 1) await new Promise((r) => setTimeout(r, 50));
      return [`v${String(calls)}`];
    };

    await cache.get("k", load);
    clock.advance(OPTIONS.ttlMs + 1);

    // Still the old value, returned without awaiting the slow refresh.
    assert.deepEqual(await cache.get("k", load), ["v1"]);
    assert.equal(cache.stats.staleHits, 1);
  });

  test("remembers an empty result for a shorter time", async () => {
    // Unknown names are the ones a crawler walking arbitrary URLs will hit,
    // so they must not reach the upstream on every request.
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);
    let calls = 0;
    const load = () => {
      calls++;
      return Promise.resolve([]);
    };

    await cache.get("missing", load);
    await cache.get("missing", load);
    assert.equal(calls, 1, "empty result should be cached");

    clock.advance(OPTIONS.negativeTtlMs + 1);
    await cache.get("missing", load);
    assert.equal(calls, 2, "and should expire sooner than a real result");
  });

  test("evicts the least recently used entry past the size limit", async () => {
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);
    const load = (v: string) => () => Promise.resolve([v]);

    for (const k of ["a", "b", "c"]) await cache.get(k, load(k));
    await cache.get("a", load("a")); // makes "b" the oldest
    await cache.get("d", load("d"));

    assert.equal(cache.stats.entries, OPTIONS.maxEntries);

    let calls = 0;
    await cache.get("b", () => {
      calls++;
      return Promise.resolve(["b"]);
    });
    assert.equal(calls, 1, "b should have been evicted");
  });

  test("does not cache a rejected load", async () => {
    const clock = fakeClock();
    const cache = new TtlCache<string[]>(OPTIONS, isEmpty, clock.now);

    await assert.rejects(
      cache.get("k", () => Promise.reject(new Error("upstream down"))),
    );

    const value = await cache.get("k", () => Promise.resolve(["recovered"]));
    assert.deepEqual(value, ["recovered"]);
  });
});
