import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { RepoReport, ValidityResponse } from '@package-validator/contracts';
import { RateLimit, STRICT_RATE_LIMIT } from '../common/rate-limit/rate-limit.decorator.js';
import { GithubService } from '../github/github.service.js';
import { ReportService } from '../report/report.service.js';
import { RepositoryRefDto } from './dto/repository-ref.dto.js';
import { ErrorDto, RepoReportDto, ValidityResponseDto } from './dto/responses.dto.js';

@Controller('repositories')
@ApiTags('repositories')
@ApiBadRequestResponse({ description: 'Validation failed', type: ErrorDto })
@ApiTooManyRequestsResponse({ description: 'Rate limit exceeded; see Retry-After', type: ErrorDto })
export class RepositoriesController {
  constructor(
    private readonly github: GithubService,
    private readonly reports: ReportService,
  ) {}

  @Get(':owner/:repo')
  @ApiOperation({ summary: 'Check that a repository exists and is public' })
  @ApiOkResponse({ type: ValidityResponseDto })
  async validity(@Param() ref: RepositoryRefDto): Promise<ValidityResponse> {
    return { valid: await this.github.repositoryExists(ref) };
  }

  @Get(':owner/:repo/report')
  @RateLimit(STRICT_RATE_LIMIT)
  @ApiOperation({ summary: 'Report outdated dependencies of package.json on the default branch' })
  @ApiOkResponse({ type: RepoReportDto })
  @ApiNotFoundResponse({ description: 'Repository does not exist or is not public', type: ErrorDto })
  @ApiUnprocessableEntityResponse({
    description: 'No package.json on the default branch, or it is not valid JSON',
    type: ErrorDto,
  })
  report(@Param() ref: RepositoryRefDto): Promise<RepoReport> {
    return this.reports.buildReport(ref);
  }
}
