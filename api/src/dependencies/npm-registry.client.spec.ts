import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { encodePackageName, NpmRegistryClient, REGISTRY_CONCURRENCY } from './npm-registry.client.js';

const config = { get: () => 'https://registry.test' } as unknown as ConfigService<AppConfig, true>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('encodePackageName', () => {
  it('encodes only the slash of a scoped name', () => {
    expect(encodePackageName('@nestjs/common')).toBe('@nestjs%2Fcommon');
    expect(encodePackageName('express')).toBe('express');
  });
});

describe('NpmRegistryClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the latest dist-tag from the configured registry', async () => {
    fetchMock.mockResolvedValue(json({ latest: '5.1.0', next: '6.0.0-beta.1' }));

    await expect(new NpmRegistryClient(config).latestVersion('@nestjs/common')).resolves.toBe('5.1.0');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.test/-/package/@nestjs%2Fcommon/dist-tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns null for a package the registry does not know', async () => {
    fetchMock.mockResolvedValue(json({ error: 'not found' }, 404));

    await expect(new NpmRegistryClient(config).latestVersion('nope')).resolves.toBeNull();
  });

  it('returns null when there is no latest tag', async () => {
    fetchMock.mockResolvedValue(json({ next: '1.0.0-rc.1' }));

    await expect(new NpmRegistryClient(config).latestVersion('rc-only')).resolves.toBeNull();
  });

  it('fails on other registry errors', async () => {
    fetchMock.mockResolvedValue(json({}, 503));

    await expect(new NpmRegistryClient(config).latestVersion('express')).rejects.toThrow('answered 503');
  });

  it('resolves many names, leaving out failures and unknown packages', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/express/')) return json({ latest: '5.1.0' });
      if (url.includes('/missing/')) return json({}, 404);
      throw new Error('timeout');
    });

    const versions = await new NpmRegistryClient(config).latestVersions(['express', 'missing', 'flaky', 'express']);

    expect([...versions]).toEqual([['express', '5.1.0']]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('treats the registry as unreachable when every lookup fails', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));

    await expect(new NpmRegistryClient(config).latestVersions(['a', 'b'])).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('keeps at most the configured number of requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return json({ latest: '1.0.0' });
    });
    const names = Array.from({ length: REGISTRY_CONCURRENCY * 3 }, (_, i) => `pkg-${i}`);

    const versions = await new NpmRegistryClient(config).latestVersions(names);

    expect(versions.size).toBe(names.length);
    expect(peak).toBe(REGISTRY_CONCURRENCY);
  });
});
