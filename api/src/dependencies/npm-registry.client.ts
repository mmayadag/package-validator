import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';

export const REGISTRY_TIMEOUT_MS = 5_000;
/** Requests in flight per report; manifests can declare a few hundred packages. */
export const REGISTRY_CONCURRENCY = 8;

interface DistTags {
  latest?: unknown;
}

/** Reads the `latest` dist-tag of packages from the npm registry (or a mirror). */
@Injectable()
export class NpmRegistryClient {
  private readonly logger = new Logger(NpmRegistryClient.name);
  private readonly registry: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.registry = config.get('npmRegistry', { infer: true });
  }

  /** The version behind `latest`, or null when the package is not published on this registry. */
  async latestVersion(name: string): Promise<string | null> {
    const url = `${this.registry}/-/package/${encodePackageName(name)}/dist-tags`;
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }

    const tags = (await response.json()) as DistTags;
    return typeof tags.latest === 'string' ? tags.latest : null;
  }

  /**
   * Latest version of every name, with at most REGISTRY_CONCURRENCY requests
   * in flight. A lookup that fails is logged and left out so one flaky
   * package does not hide the rest; when every lookup fails the registry is
   * treated as unreachable.
   */
  async latestVersions(names: Iterable<string>): Promise<Map<string, string>> {
    const queue = [...new Set(names)];
    const total = queue.length;
    const versions = new Map<string, string>();
    let failures = 0;

    const worker = async (): Promise<void> => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
        try {
          const version = await this.latestVersion(name);
          if (version !== null) {
            versions.set(name, version);
          }
        } catch (error) {
          failures += 1;
          this.logger.warn(`Could not resolve ${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(REGISTRY_CONCURRENCY, total) }, worker));

    if (failures > 0 && failures === total) {
      throw new BadGatewayException('The npm registry could not be reached');
    }
    return versions;
  }
}

/** Scoped names keep the `@` and encode only the slash, which is what the registry expects. */
export function encodePackageName(name: string): string {
  return name.replaceAll('/', '%2F');
}
