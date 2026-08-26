import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CircuitBreaker, Semaphore } from "../jorf/limiter.ts";

describe("Semaphore", () => {
  test("never exceeds the configured concurrency", async () => {
    // This is the hard ceiling on load reaching JORFSearch, whatever the
    // inbound request rate.
    const limit = 4;
    const semaphore = new Semaphore(limit);
    let running = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 50 }, () =>
        semaphore.run(async () => {
          running++;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 5));
          running--;
        }),
      ),
    );

    assert.ok(peak <= limit, `peak concurrency ${String(peak)} exceeded limit`);
    assert.equal(running, 0);
  });

  test("releases its slot when the task throws", async () => {
    const semaphore = new Semaphore(1);

    await assert.rejects(
      semaphore.run(() => Promise.reject(new Error("boom"))),
    );

    assert.equal(semaphore.active, 0);
    assert.equal(await semaphore.run(() => Promise.resolve("ok")), "ok");
  });
});

describe("CircuitBreaker", () => {
  test("stays closed below the failure threshold", () => {
    const breaker = new CircuitBreaker(3, 1000, () => 0);
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.isOpen, false);
  });

  test("opens once failures reach the threshold", () => {
    const breaker = new CircuitBreaker(3, 1000, () => 0);
    for (let i = 0; i < 3; i++) breaker.recordFailure();
    assert.equal(breaker.isOpen, true);
  });

  test("a success resets the count", () => {
    const breaker = new CircuitBreaker(3, 1000, () => 0);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    assert.equal(breaker.isOpen, false);
  });

  test("closes again after the reset window", () => {
    let now = 0;
    const breaker = new CircuitBreaker(2, 1000, () => now);
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.isOpen, true);

    now = 999;
    assert.equal(breaker.isOpen, true);

    now = 1000;
    assert.equal(breaker.isOpen, false);
  });
});
