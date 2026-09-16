import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RepositoryRef } from '@package-validator/contracts';
import { GraphQLClient } from 'graphql-request';
import type { AppConfig } from '../config/configuration.js';
import { PACKAGE_JSON_QUERY, REPOSITORY_QUERY } from './github.queries.js';

interface RepositoryResponse {
  repository: { name: string } | null;
}

interface PackageJsonResponse {
  repository: { object: { text: string | null } | null } | null;
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
   * inaccessible repository with a NOT_FOUND error, so any failure means "no".
   */
  async repositoryExists({ owner, repo }: RepositoryRef): Promise<boolean> {
    try {
      const data = await this.client.request<RepositoryResponse>(REPOSITORY_QUERY, { owner, repo });
      return data.repository !== null;
    } catch (error) {
      this.logger.warn(`Repository lookup failed for ${owner}/${repo}: ${String(error)}`);
      return false;
    }
  }

  /** Raw package.json text from the default branch, or null when there is none. */
  async getPackageJson({ owner, repo }: RepositoryRef): Promise<string | null> {
    const data = await this.client.request<PackageJsonResponse>(PACKAGE_JSON_QUERY, { owner, repo });
    return data.repository?.object?.text ?? null;
  }
}
