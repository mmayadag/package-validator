import { Injectable } from '@nestjs/common';
import {
  type ChangeKind,
  DEPENDENCY_SECTIONS,
  type DependencySection,
  type OutdatedDependencies,
} from '@package-validator/contracts';
import semver from 'semver';
import { NpmRegistryClient } from './npm-registry.client.js';

export type PackageManifest = Partial<Record<DependencySection, Record<string, string>>> & {
  name?: string;
};

@Injectable()
export class DependencyCheckerService {
  constructor(private readonly registry: NpmRegistryClient) {}

  /** Compares every declared range with the latest published version on the npm registry. */
  async findOutdated(manifest: PackageManifest): Promise<OutdatedDependencies> {
    const names = DEPENDENCY_SECTIONS.flatMap((section) =>
      Object.entries(manifest[section] ?? {})
        .filter(([, range]) => isRegistryRange(range))
        .map(([name]) => name),
    );
    const latest = await this.registry.latestVersions(names);
    return groupBySection(manifest, latest);
  }
}

export function groupBySection(
  manifest: PackageManifest,
  latestVersions: ReadonlyMap<string, string>,
): OutdatedDependencies {
  const result: OutdatedDependencies = {};

  for (const section of DEPENDENCY_SECTIONS) {
    const outdated = Object.entries(manifest[section] ?? {}).flatMap(([name, current]) => {
      const version = latestVersions.get(name);
      const latest = version !== undefined && isRegistryRange(current) ? upgradeRange(current, version) : null;
      return latest === null ? [] : [{ name, current, latest, change: classifyChange(current, latest) }];
    });

    if (outdated.length > 0) {
      result[section] = outdated;
    }
  }

  return result;
}

const NON_REGISTRY_PROTOCOL = /^(npm|git(\+\w+)?|file|link|workspace|https?|github|gist|bitbucket|gitlab):/i;
const ANY_VERSION = /^(latest|\*|x)?$/i;
const SIMPLE_RANGE = /^(\^|~|>=)?\s*v?\d+(\.(\d+|x|\*))?(\.(\d+|x|\*))?([-+][\w.+-]*)?$/;

/**
 * Whether the range names versions on the registry. Aliases, git and http
 * URLs, local paths, workspace links and `owner/repo` shorthands do not, and
 * neither does a range that accepts every version.
 */
export function isRegistryRange(range: string): boolean {
  const value = range.trim();
  if (ANY_VERSION.test(value) || NON_REGISTRY_PROTOCOL.test(value) || value.includes('/')) {
    return false;
  }
  return semver.validRange(value) !== null;
}

/**
 * The declared range moved up to the latest version: `^4.0.0` becomes
 * `^5.1.0`, `~1.2.0` becomes `~1.3.0` and an exact version stays exact. A
 * range with several comparators is replaced by the bare version. Null when
 * the range already starts at or above the latest version, or when `latest`
 * is a prerelease and the range is not, so an alpha tagged as latest is not
 * reported as an upgrade.
 */
export function upgradeRange(current: string, latest: string): string | null {
  let from: semver.SemVer | null;
  try {
    from = semver.minVersion(current);
  } catch {
    return null;
  }
  if (!from || !semver.gt(latest, from)) {
    return null;
  }
  if (semver.prerelease(latest) !== null && from.prerelease.length === 0) {
    return null;
  }
  const operator = SIMPLE_RANGE.exec(current.trim())?.[1] ?? '';
  return `${operator}${latest}`;
}

/**
 * Compares the lowest versions the two ranges allow. Below 1.0.0 a minor bump
 * is breaking under caret semantics, so it counts as major. Tags, URLs and
 * workspace references are `unknown`.
 */
export function classifyChange(current: string, latest: string): ChangeKind {
  let from: semver.SemVer | null;
  let to: semver.SemVer | null;
  try {
    from = semver.minVersion(current);
    to = semver.minVersion(latest);
  } catch {
    return 'unknown';
  }
  if (!from || !to) {
    return 'unknown';
  }

  const diff = semver.diff(from, to);
  if (diff === null) {
    return 'unknown';
  }
  if (diff.includes('major') || (from.major === 0 && diff.includes('minor'))) {
    return 'major';
  }
  return diff.includes('minor') ? 'minor' : 'patch';
}
