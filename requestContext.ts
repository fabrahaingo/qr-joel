import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  isBot: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run a request handler with its context attached. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Whether the request being served came from a crawler.
 *
 * Reported through async local storage so callers deep in the stack, such as
 * the analytics logger, do not need the request threaded through to them.
 */
export function isBotRequestContext(): boolean {
  return storage.getStore()?.isBot ?? false;
}
