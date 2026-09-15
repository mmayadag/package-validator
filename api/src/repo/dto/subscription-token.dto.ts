import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class SubscriptionTokenDto {
  /** 24 random bytes, base64url encoded. */
  @ApiProperty({ description: 'Token from the confirmation or unsubscribe link', pattern: '^[A-Za-z0-9_-]{32}$', example: 'k3jd0Qw9_xL2v-8ZpB1cT6yN4rM7aH5e' })
  @Matches(/^[A-Za-z0-9_-]{32}$/, { message: 'token is not a valid subscription token' })
  token!: string;
}
