import { ApiProperty } from '@nestjs/swagger';
import { REPORT_PERIODS, type ReportPeriod, type SubscriptionRequest } from '@package-validator/contracts';
import { IsEmail, IsIn, IsInt } from 'class-validator';
import { RepositoryRefDto } from './repository-ref.dto.js';

export class ScheduleReportDto extends RepositoryRefDto implements SubscriptionRequest {
  @ApiProperty({
    description: 'Address that receives the report after confirming',
    example: 'dev@example.com',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Hours between reports: 6, 12, 24 hours or a week (168)',
    enum: REPORT_PERIODS,
    example: 24,
  })
  @IsInt()
  @IsIn(REPORT_PERIODS)
  period!: ReportPeriod;
}
