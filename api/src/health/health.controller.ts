import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /** Liveness probe used by the Docker healthcheck. */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
