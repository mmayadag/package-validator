import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** Requests allowed per client IP within one window. */
  limit: number;
  windowMs: number;
}

/** Applies to every route without its own limit. */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = { limit: 60, windowMs: 60_000 };

/** For routes that call GitHub and the npm registry or touch subscriptions. */
export const STRICT_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 };

export const RATE_LIMIT_KEY = Symbol('rate-limit');
export const SKIP_RATE_LIMIT_KEY = Symbol('skip-rate-limit');

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
