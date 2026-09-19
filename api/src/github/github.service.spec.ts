import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ClientError, type GraphQLResponse } from 'graphql-request';
import type { AppConfig } from '../config/configuration.js';
import { GithubService } from './github.service.js';

const config = {
  get: () => ({ endpoint: 'https://api.github.test/graphql', token: 'ghp_test' }),
} as unknown as ConfigService<AppConfig, true>;

const ref = { owner: 'mmayadag', repo: 'package-validator' };

const clientError = (errors: unknown[], status: number) =>
  new ClientError({ errors, status, headers: new Headers(), body: '' } as unknown as GraphQLResponse, { query: '' });

const notFoundError = () => clientError([{ message: 'Could not resolve to a Repository', type: 'NOT_FOUND' }], 200);

const unauthorizedError = () => clientError([{ message: 'Bad credentials' }], 401);

describe('GithubService', () => {
  const request = vi.fn();
  let service: GithubService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new GithubService(config);
    (service as unknown as { client: { request: typeof request } }).client.request = request;
  });

  it('reads package.json alongside the repository, in a single request', async () => {
    request.mockResolvedValue({ repository: { name: 'package-validator', object: { text: '{}' } } });

    await expect(service.fetchPackageJson(ref)).resolves.toEqual({ exists: true, packageJson: '{}' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports no package.json when the default branch has none', async () => {
    request.mockResolvedValue({ repository: { name: 'package-validator', object: null } });

    await expect(service.fetchPackageJson(ref)).resolves.toEqual({ exists: true, packageJson: null });
  });

  it('treats a NOT_FOUND error as a missing repository', async () => {
    request.mockRejectedValue(notFoundError());

    await expect(service.fetchPackageJson(ref)).resolves.toEqual({ exists: false });
    await expect(service.repositoryExists(ref)).resolves.toBe(false);
  });

  it('rethrows a network failure as a 502', async () => {
    request.mockRejectedValue(new Error('fetch failed'));

    await expect(service.fetchPackageJson(ref)).rejects.toBeInstanceOf(BadGatewayException);
    await expect(service.repositoryExists(ref)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rethrows an unauthorized GraphQL error as a 502', async () => {
    request.mockRejectedValue(unauthorizedError());

    await expect(service.fetchPackageJson(ref)).rejects.toBeInstanceOf(BadGatewayException);
  });
});
