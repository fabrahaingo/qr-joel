import axios from "axios";
import type { AxiosError, AxiosResponse } from "axios";
import { CircuitBreaker, RequestBudget, Semaphore } from "./limiter.ts";

export const JORF_HOST = "jorfsearch.steinertriples.ch";
export const JORF_ORIGIN = `https://${JORF_HOST}`;

/**
 * JORFSearch is run by a volunteer and has no service commitment, so the
 * budget here is deliberately small: a page render must fail fast rather than
 * hold a connection open against a struggling upstream.
 */
const REQUEST_TIMEOUT_MS = 3_000;
const RETRY_MAX = 1;
const BASE_RETRY_DELAY_MS = 300;

/** Ceiling on concurrent upstream requests, whatever the inbound traffic. */
const MAX_CONCURRENT_REQUESTS = 4;

/** Refuse to buffer a response larger than this. */
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024;

const BREAKER_THRESHOLD = 5;
const BREAKER_RESET_MS = 60_000;

/** Committed ceiling on requests sent to JORFSearch in any 24 hour window. */
const DAILY_REQUEST_BUDGET = 20_000;
const BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Identifies the caller so the maintainer can reach us instead of blocking us. */
const USER_AGENT =
  "JOEL-QR/1.0 (+https://www.joel-officiel.fr; contact@joel-officiel.fr)";

export class UpstreamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamUnavailableError";
  }
}

const semaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);
const breaker = new CircuitBreaker(BREAKER_THRESHOLD, BREAKER_RESET_MS);
const budget = new RequestBudget(DAILY_REQUEST_BUDGET, BUDGET_WINDOW_MS);

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  maxRedirects: 3,
  maxContentLength: MAX_RESPONSE_BYTES,
  maxBodyLength: MAX_RESPONSE_BYTES,
  headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  validateStatus: (status) => status >= 200 && status < 300,
});

/**
 * Only a URL still on the JORFSearch origin may be followed.
 *
 * The people lookup re-requests a URL taken from the upstream response, so
 * without this check the upstream chooses which host we call.
 */
export function isJorfUrl(url: string): boolean {
  try {
    const parsed = new URL(url, JORF_ORIGIN);
    return parsed.protocol === "https:" && parsed.hostname === JORF_HOST;
  } catch {
    return false;
  }
}

function retryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = (error as AxiosError).response?.status;
  if (status === undefined) return true; // network error or timeout
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

function retryDelayMs(attempt: number, error: unknown): number {
  if (axios.isAxiosError(error)) {
    const header = error.response?.headers["retry-after"] as string | undefined;
    const seconds = header === undefined ? NaN : Number(header);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 10_000);
    }
  }
  const backoff = BASE_RETRY_DELAY_MS * 2 ** attempt;
  return backoff + Math.random() * backoff; // jitter spreads retries apart
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Perform a GET against JORFSearch, subject to the breaker and the cap. */
export async function jorfGet<T>(url: string): Promise<AxiosResponse<T>> {
  if (!isJorfUrl(url)) {
    throw new UpstreamUnavailableError(`Refusing to call a non-JORF url.`);
  }
  if (breaker.isOpen) {
    throw new UpstreamUnavailableError("JORFSearch circuit is open.");
  }
  if (!budget.tryConsume()) {
    throw new UpstreamUnavailableError("JORFSearch daily budget exhausted.");
  }

  return semaphore.run(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
      try {
        const response = await http.get<T>(url);
        breaker.recordSuccess();
        return response;
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === RETRY_MAX) break;
        await wait(retryDelayMs(attempt, error));
      }
    }
    breaker.recordFailure();
    throw lastError;
  });
}

export const clientStats = (): {
  active: number;
  queued: number;
  breakerOpen: boolean;
  budgetUsed: number;
  budgetRemaining: number;
} => ({
  active: semaphore.active,
  queued: semaphore.queued,
  breakerOpen: breaker.isOpen,
  budgetUsed: budget.used,
  budgetRemaining: budget.remaining,
});
