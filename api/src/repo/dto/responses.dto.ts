import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REPORT_PERIODS } from './schedule-report.dto.js';

/** Response shapes for the OpenAPI document; the services return the matching interfaces. */

export class ValidityResponseDto {
  @ApiProperty({ description: 'Whether the repository exists and is visible to the API' })
  valid!: boolean;
}

export class OutdatedDependencyDto {
  @ApiProperty({ example: 'express' })
  name!: string;

  @ApiProperty({ description: 'Range declared in package.json', example: '^4.17.1' })
  current!: string;

  @ApiProperty({ description: 'Range for the latest release on npm', example: '^5.1.0' })
  latest!: string;

  @ApiProperty({
    description: 'Semver distance between the two; a minor bump below 1.0.0 counts as major',
    enum: ['major', 'minor', 'patch', 'unknown'],
    example: 'major',
  })
  change!: 'major' | 'minor' | 'patch' | 'unknown';
}

export class OutdatedDependenciesDto {
  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  dependencies?: OutdatedDependencyDto[];

  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  devDependencies?: OutdatedDependencyDto[];

  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  peerDependencies?: OutdatedDependencyDto[];

  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  optionalDependencies?: OutdatedDependencyDto[];
}

export class RepoReportDto {
  @ApiProperty({ example: 'mmayadag' })
  owner!: string;

  @ApiProperty({ example: 'bicycle-in-izmir' })
  repo!: string;

  @ApiProperty({ description: 'Only sections with outdated packages are present' })
  outdated!: OutdatedDependenciesDto;

  @ApiProperty({ description: 'When the npm registry was queried; reports are reused for up to an hour', format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ description: 'HTML tables, values escaped' })
  html!: string;

  @ApiProperty({ description: 'Plain-text version of the report' })
  text!: string;
}

export class SubscriptionSummaryDto {
  @ApiProperty({ description: 'pending until the address owner confirms by email', enum: ['pending', 'active'] })
  status!: 'pending' | 'active';

  @ApiProperty({ enum: REPORT_PERIODS })
  periodHours!: number;

  @ApiProperty({ description: 'When the next report is due; null until the first one was delivered', format: 'date-time', nullable: true, type: String })
  nextReportAt!: string | null;
}

export class ScheduledReportDto extends RepoReportDto {
  @ApiProperty({ description: 'Whether a confirmation request or the report itself was emailed' })
  emailSent!: boolean;

  @ApiProperty()
  subscription!: SubscriptionSummaryDto;
}

export class ConfirmedSubscriptionDto {
  @ApiProperty({ example: 'mmayadag' })
  owner!: string;

  @ApiProperty({ example: 'bicycle-in-izmir' })
  repo!: string;

  @ApiProperty({ example: 'dev@example.com' })
  email!: string;

  @ApiProperty()
  subscription!: SubscriptionSummaryDto;
}

export class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}

export class ErrorDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ description: 'One message, or one per failed validation rule', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Not Found' })
  error?: string;
}
