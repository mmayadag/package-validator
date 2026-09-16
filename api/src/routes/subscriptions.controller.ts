import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { ConfirmedSubscription, ScheduledReport } from '@package-validator/contracts';
import { RateLimit, STRICT_RATE_LIMIT } from '../common/rate-limit/rate-limit.decorator.js';
import { SubscriptionService } from '../subscriptions/subscription.service.js';
import { ConfirmedSubscriptionDto, ErrorDto, ScheduledReportDto } from './dto/responses.dto.js';
import { ScheduleReportDto } from './dto/schedule-report.dto.js';
import { SubscriptionTokenDto } from './dto/subscription-token.dto.js';

/** Email subscriptions to a repository's report; every route calls GitHub or touches the store, so all are strictly limited. */
@Controller('subscriptions')
@ApiTags('subscriptions')
@RateLimit(STRICT_RATE_LIMIT)
@ApiBadRequestResponse({ description: 'Validation failed', type: ErrorDto })
@ApiTooManyRequestsResponse({ description: 'Rate limit exceeded; see Retry-After', type: ErrorDto })
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Post()
  @ApiOperation({
    summary: 'Build the report and subscribe an address to it',
    description:
      'A new address receives a confirmation email and stays pending until it confirms; an already confirmed address gets the report right away. One subscription per address and repository; posting again only changes the period.',
  })
  @ApiCreatedResponse({ type: ScheduledReportDto })
  @ApiNotFoundResponse({ description: 'Repository does not exist or is not public', type: ErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'No package.json on the default branch, or it is not valid JSON', type: ErrorDto })
  subscribe(@Body() { owner, repo, email, period }: ScheduleReportDto): Promise<ScheduledReport> {
    return this.subscriptions.subscribe({ owner, repo, email, period });
  }

  @Post(':token/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a subscription with the token from the email link', description: 'Activates the subscription and sends the first report. Idempotent.' })
  @ApiOkResponse({ type: ConfirmedSubscriptionDto })
  @ApiNotFoundResponse({ description: 'Unknown token, or the confirmation window of 24 hours has passed', type: ErrorDto })
  confirm(@Param() { token }: SubscriptionTokenDto): Promise<ConfirmedSubscription> {
    return this.subscriptions.confirm(token);
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe with the token from the email link' })
  @ApiNoContentResponse({ description: 'Subscription removed' })
  @ApiNotFoundResponse({ description: 'Unknown token or already removed', type: ErrorDto })
  unsubscribe(@Param() { token }: SubscriptionTokenDto): void {
    this.subscriptions.unsubscribe(token);
  }
}
