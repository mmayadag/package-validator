import { ApiProperty } from '@nestjs/swagger';
import { GITHUB_OWNER_PATTERN, GITHUB_REPO_PATTERN, type RepositoryRef } from '@package-validator/contracts';
import { Matches } from 'class-validator';

/** GitHub's own naming rules, checked before any request leaves the API. */
export class RepositoryRefDto implements RepositoryRef {
  @ApiProperty({ description: 'GitHub user or organisation', example: 'mmayadag', maxLength: 39 })
  @Matches(new RegExp(`^${GITHUB_OWNER_PATTERN}$`), { message: 'owner must be a valid GitHub user or organisation name' })
  owner!: string;

  @ApiProperty({ description: 'Repository name', example: 'bicycle-in-izmir', maxLength: 100 })
  @Matches(new RegExp(`^${GITHUB_REPO_PATTERN}$`), { message: 'repo must be a valid GitHub repository name' })
  repo!: string;
}
