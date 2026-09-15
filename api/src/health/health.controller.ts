import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipRateLimit } from '../common/rate-limit/rate-limit.decorator.js';
import { HealthDto } from '../repo/dto/responses.dto.js';

@Controller('health')
@ApiTags('health')
@SkipRateLimit()
export class HealthController {
  /** Liveness probe used by the Docker healthcheck. */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthDto })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
