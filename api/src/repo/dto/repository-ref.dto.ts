import { Matches } from 'class-validator';

/** GitHub's own naming rules, checked before any request leaves the API. */
export class RepositoryRefDto {
  @Matches(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, { message: 'owner must be a valid GitHub user or organisation name' })
  owner!: string;

  @Matches(/^[A-Za-z0-9._-]{1,100}$/, { message: 'repo must be a valid GitHub repository name' })
  repo!: string;
}
