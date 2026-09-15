import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, confirmSubscription, isValidRepository, scheduleReport, unsubscribe } from './api';

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes the repository into the validity URL', async () => {
    const fetch = respond(200, { valid: true });

    await expect(isValidRepository({ owner: 'mmayadag', repo: 'next.js' })).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith('/repo/isValid/mmayadag/next.js', expect.anything());
  });

  it('posts the schedule request as JSON', async () => {
    const fetch = respond(200, { owner: 'a', repo: 'b', outdated: {}, text: '', emailSent: false });

    await scheduleReport({ owner: 'a', repo: 'b', email: 'dev@example.com', period: 24 });

    const [, init] = fetch.mock.calls[0];
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({ owner: 'a', repo: 'b', email: 'dev@example.com', period: 24 });
  });

  it('surfaces the validation messages Nest returns', async () => {
    respond(400, { message: ['email must be an email'], statusCode: 400 });

    const error = await scheduleReport({ owner: 'a', repo: 'b', email: 'x', period: 24 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'email must be an email' });
  });

  it('deletes a subscription by token and accepts an empty 204 response', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(unsubscribe('abc_DEF-123')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/repo/subscriptions/abc_DEF-123', expect.objectContaining({ method: 'DELETE' }));
  });

  it('reports an unknown unsubscribe token as a 404 ApiError', async () => {
    respond(404, { message: 'Subscription not found or already removed', statusCode: 404 });

    await expect(unsubscribe('gone')).rejects.toMatchObject({ status: 404 });
  });
});

describe('confirmSubscription', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts to the confirm endpoint and returns the subscription', async () => {
    const body = { owner: 'a', repo: 'b', email: 'dev@example.com', subscription: { status: 'active', periodHours: 24, nextReportAt: null } };
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

    await expect(confirmSubscription('abc_DEF-123')).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/repo/subscriptions/abc_DEF-123/confirm', expect.objectContaining({ method: 'POST' }));
  });
});
