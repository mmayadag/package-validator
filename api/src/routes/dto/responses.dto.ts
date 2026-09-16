import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CHANGE_KINDS,
  type ChangeKind,
  type ConfirmedSubscription,
  type ErrorResponse,
  type OutdatedDependencies,
  type OutdatedDependency,
  REPORT_PERIODS,
  type RepoReport,
  type ReportPeriod,
  type ScheduledReport,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
  type SubscriptionSummary,
  type ValidityResponse,
} from '@package-validator/contracts';

/** Response shapes for the OpenAPI document; each implements the contract the services return. */

export class ValidityResponseDto implements ValidityResponse {
  @ApiProperty({ description: 'Whether the repository exists and is visible to the API' })
  valid!: boolean;
}

export class OutdatedDependencyDto implements OutdatedDependency {
  @ApiProperty({ example: 'express' })
  name!: string;

  @ApiProperty({ description: 'Range declared in package.json', example: '^4.17.1' })
  current!: string;

  @ApiProperty({ description: 'Range for the latest release on npm', example: '^5.1.0' })
  latest!: string;

  @ApiProperty({
    description: 'Semver distance between the two; a minor bump below 1.0.0 counts as major',
    enum: CHANGE_KINDS,
    example: 'major',
  })
  change!: ChangeKind;
}

export class OutdatedDependenciesDto implements OutdatedDependencies {
  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  dependencies?: OutdatedDependencyDto[];

  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  devDependencies?: OutdatedDependencyDto[];

  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  peerDependencies?: OutdatedDependencyDto[];

  @ApiPropertyOptional({ type: [OutdatedDependencyDto] })
  optionalDependencies?: OutdatedDependencyDto[];
}

export class RepoReportDto implements RepoReport {
  @ApiProperty({ example: 'mmayadag' })
  owner!: string;

  @ApiProperty({ example: 'bicycle-in-izmir' })
  repo!: string;

  @ApiProperty({ description: 'Only sections with outdated packages are present' })
  outdated!: OutdatedDependenciesDto;

  @ApiProperty({
    description: 'When the npm registry was queried; reports are reused for up to an hour',
    format: 'date-time',
  })
  generatedAt!: string;

  @ApiProperty({ description: 'HTML tables, values escaped' })
  html!: string;

  @ApiProperty({ description: 'Plain-text version of the report' })
  text!: string;
}

export class SubscriptionSummaryDto implements SubscriptionSummary {
  @ApiProperty({ description: 'pending until the address owner confirms by email', enum: SUBSCRIPTION_STATUSES })
  status!: SubscriptionStatus;

  @ApiProperty({ enum: REPORT_PERIODS })
  periodHours!: ReportPeriod;

  @ApiProperty({
    description: 'When the next report is due; null until the first one was delivered',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  nextReportAt!: string | null;
}

export class ScheduledReportDto extends RepoReportDto implements ScheduledReport {
  @ApiProperty({ description: 'Whether a confirmation request or the report itself was emailed' })
  emailSent!: boolean;

  @ApiProperty()
  subscription!: SubscriptionSummaryDto;
}

export class ConfirmedSubscriptionDto implements ConfirmedSubscription {
  @ApiProperty({ example: 'mmayadag' })
  owner!: string;

  @ApiProperty({ example: 'bicycle-in-izmir' })
  repo!: string;

  @ApiProperty({ example: 'dev@example.com' })
  email!: string;

  @ApiProperty()
  subscription!: SubscriptionSummaryDto;
}

export class ErrorDto implements ErrorResponse {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({
    description: 'One message, or one per failed validation rule',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Not Found' })
  error?: string;
}
