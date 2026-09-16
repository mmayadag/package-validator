import { randomUUID } from 'node:crypto';
import { Logger, type LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';
/** A client-supplied id is kept only when it is short and printable, so logs stay clean. */
const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;
/** Subscription tokens travel in the path and are secrets; they are masked in the log. */
const SUBSCRIPTION_TOKEN = /(\/subscriptions\/)[A-Za-z0-9_-]{32}(?=\/|$)/;
/** Probes are noisy and carry no information. */
const UNLOGGED_PATHS = new Set(['/health']);

export const resolveRequestId = (header: unknown): string =>
  typeof header === 'string' && REQUEST_ID.test(header) ? header : randomUUID();

export const maskPath = (path: string): string => path.replace(SUBSCRIPTION_TOKEN, '$1:token');

/**
 * Gives every request an id (taken from X-Request-Id when the caller sends
 * one), returns it in the response, and writes one log line per request:
 * method, path, status, duration and client address.
 */
export function requestLog(logger: LoggerService = new Logger('HTTP')) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
    const startedAt = process.hrtime.bigint();
    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.once('finish', () => {
      if (UNLOGGED_PATHS.has(request.path)) return;
      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      const path = maskPath(request.path);
      const { method } = request;
      const status = response.statusCode;
      logger.log(`${method} ${path} ${status} ${durationMs}ms`, {
        requestId,
        method,
        path,
        status,
        durationMs,
        ip: request.ip,
      });
    });

    requestContext.run({ requestId }, next);
  };
}
