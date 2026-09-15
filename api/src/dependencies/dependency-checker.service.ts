import { Injectable } from '@nestjs/common';
import ncu from 'npm-check-updates';

export const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export type DependencySection = (typeof DEPENDENCY_SECTIONS)[number];

export type PackageManifest = Partial<Record<DependencySection, Record<string, string>>> & {
  name?: string;
};

export interface OutdatedDependency {
  name: string;
  current: string;
  latest: string;
}

export type OutdatedDependencies = Partial<Record<DependencySection, OutdatedDependency[]>>;

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
      .map(([name, current]) => ({ name, current, latest: upgraded[name] }));

    if (outdated.length > 0) {
      result[section] = outdated;
    }
  }

  return result;
}
