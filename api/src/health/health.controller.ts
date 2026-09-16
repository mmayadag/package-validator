import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@package-validator/contracts';
import { SkipRateLimit } from '../common/rate-limit/rate-limit.decorator.js';
import { HealthDto } from './health.dto.js';

@Controller('health')
@ApiTags('health')
@SkipRateLimit()
export class HealthController {
  /** Liveness probe used by the Docker healthcheck. */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthDto })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
