import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RepositoryRef } from '@package-validator/contracts';
import { ClientError, GraphQLClient } from 'graphql-request';
import type { AppConfig } from '../config/configuration.js';
import { REPOSITORY_QUERY, REPOSITORY_WITH_PACKAGE_JSON_QUERY } from './github.queries.js';

interface RepositoryResponse {
  repository: { name: string } | null;
}

interface RepositoryWithPackageJsonResponse {
  repository: { name: string; object: { text: string | null } | null } | null;
}

/** `exists: false` means the repository does not exist or is not accessible. */
export type PackageJsonResult = { exists: false } | { exists: true; packageJson: string | null };

/** GitHub answers an unknown or inaccessible repository with this error type. */
function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof ClientError &&
    (error.response.errors ?? []).some((graphqlError) => (graphqlError as { type?: unknown }).type === 'NOT_FOUND')
  );
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly client: GraphQLClient;

  constructor(config: ConfigService<AppConfig, true>) {
    const { endpoint, token } = config.get('github', { infer: true });
    this.client = new GraphQLClient(endpoint, {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  /**
   * True when the token can see the repository. GitHub answers an unknown or
   * inaccessible repository with a NOT_FOUND error, so that (and a null
   * repository) mean "no".
   */
  async repositoryExists(ref: RepositoryRef): Promise<boolean> {
    const data = await this.request<RepositoryResponse>(REPOSITORY_QUERY, ref);
    return data !== null && data.repository !== null;
  }

  /** Repository existence and its package.json in a single request. */
  async fetchPackageJson(ref: RepositoryRef): Promise<PackageJsonResult> {
    const data = await this.request<RepositoryWithPackageJsonResponse>(REPOSITORY_WITH_PACKAGE_JSON_QUERY, ref);
    if (data === null || data.repository === null) return { exists: false };
    return { exists: true, packageJson: data.repository.object?.text ?? null };
  }

  /**
   * Runs a query, treating a GitHub NOT_FOUND error as "no such data" (null).
   * Any other failure — a network error, a bad token, a rate limit, a 5xx or
   * a malformed response — is not an answer about the repository, so it is
   * logged and rethrown as a 502.
   */
  private async request<T>(query: string, { owner, repo }: RepositoryRef): Promise<T | null> {
    try {
      return await this.client.request<T>(query, { owner, repo });
    } catch (error) {
      if (isNotFoundError(error)) return null;
      this.logger.error(`GitHub request failed for ${owner}/${repo}: ${String(error)}`);
      throw new BadGatewayException('GitHub could not be reached');
    }
  }
}
