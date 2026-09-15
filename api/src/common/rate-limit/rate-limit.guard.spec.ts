import { type ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimit, SkipRateLimit } from './rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

class TestController {
  @RateLimit({ limit: 2, windowMs: 1_000 })
  strict() {}

  open() {}

  @SkipRateLimit()
  health() {}
}

const handlers = TestController.prototype;

function contextFor(handler: () => void, ip = '203.0.113.1') {
  const headers: Record<string, unknown> = {};
  const context = {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader: (name: string, value: unknown) => (headers[name] = value) }),
    }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  const call = (handler: () => void, ip?: string) => {
    const { context, headers } = contextFor(handler, ip);
    try {
      return { allowed: guard.canActivate(context), headers };
    } catch (error) {
      return { allowed: false, error, headers };
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    guard = new RateLimitGuard(new Reflector());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit and then answers 429 with Retry-After', () => {
    expect(call(handlers.strict).allowed).toBe(true);
    const second = call(handlers.strict);
    expect(second.headers).toMatchObject({ 'RateLimit-Limit': 2, 'RateLimit-Remaining': 0, 'RateLimit-Reset': 1 });

    const third = call(handlers.strict);

    expect(third.allowed).toBe(false);
    expect(third.error).toBeInstanceOf(HttpException);
    expect((third.error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(third.headers['Retry-After']).toBe(1);
  });

  it('starts a new window once the previous one has passed', () => {
    call(handlers.strict);
    call(handlers.strict);
    expect(call(handlers.strict).allowed).toBe(false);

    vi.advanceTimersByTime(1_000);

    expect(call(handlers.strict).allowed).toBe(true);
  });

  it('counts every client IP separately', () => {
    call(handlers.strict, '203.0.113.1');
    call(handlers.strict, '203.0.113.1');

    expect(call(handlers.strict, '203.0.113.2').allowed).toBe(true);
  });

  it('uses the default limit of 60 per minute for undecorated routes', () => {
    for (let i = 0; i < 60; i += 1) {
      expect(call(handlers.open).allowed).toBe(true);
    }

    expect(call(handlers.open).allowed).toBe(false);
  });

  it('never limits routes marked with SkipRateLimit', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(call(handlers.health).allowed).toBe(true);
    }
  });
});
