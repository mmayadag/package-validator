import { Matches } from 'class-validator';

export class UnsubscribeTokenDto {
  /** 24 random bytes, base64url encoded. */
  @Matches(/^[A-Za-z0-9_-]{32}$/, { message: 'token is not a valid unsubscribe token' })
  token!: string;
}
