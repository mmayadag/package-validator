import { Controller, Get } from '@nestjs/common';
import { SkipRateLimit } from '../common/rate-limit/rate-limit.decorator.js';

@Controller('health')
@SkipRateLimit()
export class HealthController {
  /** Liveness probe used by the Docker healthcheck. */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
