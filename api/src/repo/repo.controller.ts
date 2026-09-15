import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { RepositoryRefDto } from './dto/repository-ref.dto.js';
import { ScheduleReportDto } from './dto/schedule-report.dto.js';
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
  details(@Param() ref: RepositoryRefDto): Promise<RepoReport> {
    return this.repoService.buildReport(ref);
  }

  @Post('schedule')
  @HttpCode(HttpStatus.OK)
  schedule(@Body() { owner, repo, email }: ScheduleReportDto): Promise<ScheduledReport> {
    return this.repoService.sendReport({ owner, repo }, email);
  }
}
