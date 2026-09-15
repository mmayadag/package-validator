import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { RateLimit, STRICT_RATE_LIMIT } from '../common/rate-limit/rate-limit.decorator.js';
import { RepositoryRefDto } from './dto/repository-ref.dto.js';
import { ErrorDto, RepoReportDto, ValidityResponseDto } from './dto/responses.dto.js';
import { type RepoReport, RepoService } from './repo.service.js';

interface ValidityResponse {
  valid: boolean;
}

@Controller('repo')
@ApiTags('repositories')
@ApiBadRequestResponse({ description: 'Validation failed', type: ErrorDto })
@ApiTooManyRequestsResponse({ description: 'Rate limit exceeded; see Retry-After', type: ErrorDto })
export class RepoController {
  constructor(private readonly repoService: RepoService) {}

  @Get('isValid/:owner/:repo')
  @ApiOperation({ summary: 'Check that a repository exists and is public' })
  @ApiOkResponse({ type: ValidityResponseDto })
  async isValidByPath(@Param() ref: RepositoryRefDto): Promise<ValidityResponse> {
    return { valid: await this.repoService.isValid(ref) };
  }

  @Post('isValid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check that a repository exists and is public (body variant)' })
  @ApiOkResponse({ type: ValidityResponseDto })
  async isValid(@Body() ref: RepositoryRefDto): Promise<ValidityResponse> {
    return { valid: await this.repoService.isValid(ref) };
  }

  @Get('details/:owner/:repo')
  @RateLimit(STRICT_RATE_LIMIT)
  @ApiOperation({ summary: 'Report outdated dependencies of package.json on the default branch' })
  @ApiOkResponse({ type: RepoReportDto })
  @ApiNotFoundResponse({ description: 'Repository does not exist or is not public', type: ErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'No package.json on the default branch, or it is not valid JSON', type: ErrorDto })
  details(@Param() ref: RepositoryRefDto): Promise<RepoReport> {
    return this.repoService.buildReport(ref);
  }
}
