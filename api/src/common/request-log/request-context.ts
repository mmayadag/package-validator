import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

/** Carries the request id through every async step of a request so log lines can be tied to it. */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentRequestId = (): string | undefined => requestContext.getStore()?.requestId;
