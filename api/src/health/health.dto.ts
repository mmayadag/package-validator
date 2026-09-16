import { ApiProperty } from '@nestjs/swagger';
import type { HealthResponse } from '@package-validator/contracts';

export class HealthDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}
