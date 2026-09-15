import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_KEY,
  type RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.decorator.js';

interface Window {
  count: number;
  resetAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Fixed-window limit per client IP and route, kept in memory. That is enough for
 * the single API container; several replicas would need a shared store.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private lastSweep = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) {
      return true;
    }

    const { limit, windowMs } =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, targets) ?? DEFAULT_RATE_LIMIT;
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    this.sweep(now);

    const key = `${context.getClass().name}.${context.getHandler().name}:${request.ip ?? 'unknown'}`;
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;

    const resetSeconds = Math.ceil((window.resetAt - now) / 1000);
    response.setHeader('RateLimit-Limit', limit);
    response.setHeader('RateLimit-Remaining', Math.max(0, limit - window.count));
    response.setHeader('RateLimit-Reset', resetSeconds);

    if (window.count > limit) {
      response.setHeader('Retry-After', resetSeconds);
      throw new HttpException('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) {
      return;
    }
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}
