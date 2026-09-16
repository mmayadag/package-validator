import { EventEmitter } from 'node:events';
import type { LoggerService } from '@nestjs/common';
import type { Request, Response } from 'express';
import { currentRequestId } from './request-context.js';
import { maskPath, requestLog, resolveRequestId } from './request-log.middleware.js';

describe('resolveRequestId', () => {
  it('keeps a short printable id from the caller', () => {
    expect(resolveRequestId('trace-1.2_3')).toBe('trace-1.2_3');
  });

  it.each([undefined, '', 'has space', 'x'.repeat(129), ['a', 'b']])('replaces %j with a UUID', (header) => {
    expect(resolveRequestId(header)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('maskPath', () => {
  it('hides subscription tokens', () => {
    const token = 'k3jd0Qw9_xL2v-8ZpB1cT6yN4rM7aH5e';
    expect(maskPath(`/v1/subscriptions/${token}`)).toBe('/v1/subscriptions/:token');
    expect(maskPath(`/v1/subscriptions/${token}/confirm`)).toBe('/v1/subscriptions/:token/confirm');
  });

  it('leaves other paths alone', () => {
    expect(maskPath('/v1/repositories/mmayadag/app/report')).toBe('/v1/repositories/mmayadag/app/report');
    expect(maskPath('/v1/subscriptions/short')).toBe('/v1/subscriptions/short');
  });
});

describe('requestLog', () => {
  const logger = { log: vi.fn() } as unknown as LoggerService & { log: ReturnType<typeof vi.fn> };
  const headers: Record<string, unknown> = {};

  const run = (path: string, requestHeaders: Record<string, string> = {}, status = 200) => {
    const response = Object.assign(new EventEmitter(), {
      statusCode: status,
      setHeader: (name: string, value: unknown) => (headers[name] = value),
    }) as unknown as Response;
    const request = { method: 'GET', path, headers: requestHeaders, ip: '203.0.113.7' } as unknown as Request;
    let idInsideHandler: string | undefined;
    requestLog(logger)(request, response, () => (idInsideHandler = currentRequestId()));
    response.emit('finish');
    return idInsideHandler;
  };

  beforeEach(() => vi.resetAllMocks());

  it('answers with the request id and makes it available to the handler', () => {
    const id = run('/v1/repositories/a/b', { 'x-request-id': 'abc-123' });

    expect(id).toBe('abc-123');
    expect(headers['x-request-id']).toBe('abc-123');
  });

  it('writes one line per request with the masked path', () => {
    run('/v1/subscriptions/k3jd0Qw9_xL2v-8ZpB1cT6yN4rM7aH5e', {}, 404);

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/v1\/subscriptions\/:token 404 \d+ms$/),
      expect.objectContaining({
        method: 'GET',
        path: '/v1/subscriptions/:token',
        status: 404,
        ip: '203.0.113.7',
        requestId: expect.any(String),
      }),
    );
  });

  it('does not log the health probe', () => {
    run('/health');

    expect(logger.log).not.toHaveBeenCalled();
  });
});
