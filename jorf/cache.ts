/**
 * TTL cache with stale-while-revalidate, negative caching and single-flight.
 *
 * Every entry keeps serving after it expires while a refresh runs in the
 * background, so an upstream hiccup degrades freshness rather than
 * availability.
 */

interface Entry<V> {
  value: V;
  /** When the value stops being fresh. */
  expiresAt: number;
  /** When the value stops being servable at all. */
  discardAt: number;
}

export interface CacheOptions {
  /** How long a value stays fresh, in milliseconds. */
  ttlMs: number;
  /** How long past expiry a stale value may still be served. */
  staleMs: number;
  /** How long a "no result" answer is remembered. */
  negativeTtlMs: number;
  /** Maximum number of entries before the oldest are evicted. */
  maxEntries: number;
}

export interface CacheStats {
  hits: number;
  staleHits: number;
  misses: number;
  coalesced: number;
  upstreamCalls: number;
  entries: number;
}

/** True when the value carries no useful result and should be cached briefly. */
export type IsEmpty<V> = (value: V) => boolean;

export class TtlCache<V> {
  readonly #entries = new Map<string, Entry<V>>();
  readonly #inFlight = new Map<string, Promise<V>>();
  readonly #stats = {
    hits: 0,
    staleHits: 0,
    misses: 0,
    coalesced: 0,
    upstreamCalls: 0,
  };

  readonly #options: CacheOptions;
  readonly #isEmpty: IsEmpty<V>;
  readonly #now: () => number;

  constructor(
    options: CacheOptions,
    isEmpty: IsEmpty<V>,
    now: () => number = Date.now,
  ) {
    this.#options = options;
    this.#isEmpty = isEmpty;
    this.#now = now;
  }

  get stats(): CacheStats {
    return { ...this.#stats, entries: this.#entries.size };
  }

  /**
   * Return the cached value, or call `load` at most once for concurrent
   * callers sharing a key.
   */
  async get(key: string, load: () => Promise<V>): Promise<V> {
    const now = this.#now();
    const entry = this.#entries.get(key);

    if (entry !== undefined && now < entry.expiresAt) {
      this.#stats.hits++;
      this.#touch(key, entry);
      return entry.value;
    }

    // A stale value is served immediately; the refresh runs detached so the
    // caller never waits on the upstream.
    if (entry !== undefined && now < entry.discardAt) {
      this.#stats.staleHits++;
      if (!this.#inFlight.has(key))
        void this.#load(key, load).catch(() => null);
      return entry.value;
    }

    this.#stats.misses++;
    return this.#load(key, load);
  }

  #load(key: string, load: () => Promise<V>): Promise<V> {
    const existing = this.#inFlight.get(key);
    if (existing !== undefined) {
      this.#stats.coalesced++;
      return existing;
    }

    this.#stats.upstreamCalls++;
    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.#inFlight.delete(key);
      });

    this.#inFlight.set(key, promise);
    return promise;
  }

  set(key: string, value: V): void {
    const now = this.#now();
    const ttl = this.#isEmpty(value)
      ? this.#options.negativeTtlMs
      : this.#options.ttlMs;
    this.#entries.delete(key);
    this.#entries.set(key, {
      value,
      expiresAt: now + ttl,
      discardAt: now + ttl + this.#options.staleMs,
    });
    this.#evict();
  }

  clear(): void {
    this.#entries.clear();
    this.#inFlight.clear();
  }

  #touch(key: string, entry: Entry<V>): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
  }

  #evict(): void {
    while (this.#entries.size > this.#options.maxEntries) {
      const oldest = this.#entries.keys().next();
      if (oldest.done === true) return;
      this.#entries.delete(oldest.value);
    }
  }
}
