import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt } from 'class-validator';
import { RepositoryRefDto } from './repository-ref.dto.js';

export const REPORT_PERIODS = [6, 12, 24] as const;

export class ScheduleReportDto extends RepositoryRefDto {
  @ApiProperty({ description: 'Address that receives the report after confirming', example: 'dev@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Hours between reports', enum: REPORT_PERIODS, example: 24 })
  @IsInt()
  @IsIn(REPORT_PERIODS)
  period!: (typeof REPORT_PERIODS)[number];
}
