import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { RateLimit, STRICT_RATE_LIMIT } from '../common/rate-limit/rate-limit.decorator.js';
import { RepositoryRefDto } from './dto/repository-ref.dto.js';
import { ScheduleReportDto } from './dto/schedule-report.dto.js';
import { UnsubscribeTokenDto } from './dto/unsubscribe-token.dto.js';
import { type RepoReport, RepoService, type ScheduledReport } from './repo.service.js';

interface ValidityResponse {
  valid: boolean;
}

@Controller('repo')
export class RepoController {
  constructor(private readonly repoService: RepoService) {}

  @Get('isValid/:owner/:repo')
  async isValidByPath(@Param() ref: RepositoryRefDto): Promise<ValidityResponse> {
    return { valid: await this.repoService.isValid(ref) };
  }

  @Post('isValid')
  @HttpCode(HttpStatus.OK)
  async isValid(@Body() ref: RepositoryRefDto): Promise<ValidityResponse> {
    return { valid: await this.repoService.isValid(ref) };
  }

  @Get('details/:owner/:repo')
  @RateLimit(STRICT_RATE_LIMIT)
  details(@Param() ref: RepositoryRefDto): Promise<RepoReport> {
    return this.repoService.buildReport(ref);
  }

  @Post('schedule')
  @HttpCode(HttpStatus.OK)
  @RateLimit(STRICT_RATE_LIMIT)
  schedule(@Body() { owner, repo, email, period }: ScheduleReportDto): Promise<ScheduledReport> {
    return this.repoService.subscribe({ owner, repo, email, period });
  }

  @Delete('subscriptions/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(STRICT_RATE_LIMIT)
  unsubscribe(@Param() { token }: UnsubscribeTokenDto): void {
    this.repoService.unsubscribe(token);
  }
}
