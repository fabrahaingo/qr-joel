/** Caps how many operations run at once, queueing the rest. */
export class Semaphore {
  #active = 0;
  #queue: (() => void)[] = [];

  readonly #limit: number;

  constructor(limit: number) {
    this.#limit = limit;
  }

  get active(): number {
    return this.#active;
  }

  get queued(): number {
    return this.#queue.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.#acquire();
    try {
      return await fn();
    } finally {
      this.#release();
    }
  }

  #acquire(): Promise<void> {
    if (this.#active < this.#limit) {
      this.#active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.#queue.push(() => {
        this.#active++;
        resolve();
      });
    });
  }

  #release(): void {
    this.#active--;
    this.#queue.shift()?.();
  }
}

/**
 * Stops calling a failing upstream for a while.
 *
 * Retrying into a service that is already down adds load exactly when it can
 * least take it, and makes every one of our own requests wait for the full
 * retry budget first.
 */
export class CircuitBreaker {
  #consecutiveFailures = 0;
  #openedAt: number | null = null;

  readonly #threshold: number;
  readonly #resetMs: number;
  readonly #now: () => number;

  constructor(
    threshold: number,
    resetMs: number,
    now: () => number = Date.now,
  ) {
    this.#threshold = threshold;
    this.#resetMs = resetMs;
    this.#now = now;
  }

  get isOpen(): boolean {
    if (this.#openedAt === null) return false;
    if (this.#now() - this.#openedAt >= this.#resetMs) {
      this.#openedAt = null;
      this.#consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.#consecutiveFailures = 0;
    this.#openedAt = null;
  }

  recordFailure(): void {
    this.#consecutiveFailures++;
    if (this.#consecutiveFailures >= this.#threshold) {
      this.#openedAt = this.#now();
    }
  }
}

/**
 * Hard ceiling on upstream requests per rolling window.
 *
 * The cache and the concurrency cap bound the rate; this bounds the total, so
 * a sustained crawl cannot quietly turn into tens of thousands of requests
 * against a volunteer-run service.
 */
export class RequestBudget {
  #used = 0;
  #windowStart: number;

  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
    this.#windowStart = now();
  }

  get used(): number {
    this.#rollover();
    return this.#used;
  }

  get remaining(): number {
    return Math.max(0, this.#limit - this.used);
  }

  /** Consume one unit, or report that the budget is exhausted. */
  tryConsume(): boolean {
    this.#rollover();
    if (this.#used >= this.#limit) return false;
    this.#used++;
    return true;
  }

  #rollover(): void {
    const now = this.#now();
    if (now - this.#windowStart >= this.#windowMs) {
      this.#windowStart = now;
      this.#used = 0;
    }
  }
}
