import { Injectable } from '@nestjs/common';
import {
  type ChangeKind,
  DEPENDENCY_SECTIONS,
  type DependencySection,
  type OutdatedDependencies,
} from '@package-validator/contracts';
import ncu from 'npm-check-updates';
import semver from 'semver';

export type PackageManifest = Partial<Record<DependencySection, Record<string, string>>> & {
  name?: string;
};

@Injectable()
export class DependencyCheckerService {
  /** Compares every declared range with the latest published version on the npm registry. */
  async findOutdated(manifest: PackageManifest): Promise<OutdatedDependencies> {
    const upgraded = (await ncu.run({
      packageData: JSON.stringify(manifest),
      jsonUpgraded: true,
      target: 'latest',
      loglevel: 'silent',
    })) as Record<string, string> | undefined;

    return groupBySection(manifest, upgraded ?? {});
  }
}

export function groupBySection(
  manifest: PackageManifest,
  upgraded: Record<string, string>,
): OutdatedDependencies {
  const result: OutdatedDependencies = {};

  for (const section of DEPENDENCY_SECTIONS) {
    const declared = manifest[section] ?? {};
    const outdated = Object.entries(declared)
      .filter(([name]) => name in upgraded)
      .map(([name, current]) => ({ name, current, latest: upgraded[name], change: classifyChange(current, upgraded[name]) }));

    if (outdated.length > 0) {
      result[section] = outdated;
    }
  }

  return result;
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
