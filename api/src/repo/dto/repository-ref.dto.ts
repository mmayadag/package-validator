import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** GitHub's own naming rules, checked before any request leaves the API. */
export class RepositoryRefDto {
  @ApiProperty({ description: 'GitHub user or organisation', example: 'mmayadag', maxLength: 39 })
  @Matches(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, { message: 'owner must be a valid GitHub user or organisation name' })
  owner!: string;

  @ApiProperty({ description: 'Repository name', example: 'bicycle-in-izmir', maxLength: 100 })
  @Matches(/^[A-Za-z0-9._-]{1,100}$/, { message: 'repo must be a valid GitHub repository name' })
  repo!: string;
}
