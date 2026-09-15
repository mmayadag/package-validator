import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, isValidRepository, scheduleReport } from './api';

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
});
