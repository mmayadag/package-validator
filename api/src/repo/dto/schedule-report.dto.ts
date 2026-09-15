import { IsEmail, IsIn, IsInt } from 'class-validator';
import { RepositoryRefDto } from './repository-ref.dto.js';

export const REPORT_PERIODS = [6, 12, 24] as const;

export class ScheduleReportDto extends RepositoryRefDto {
  @IsEmail()
  email!: string;

  /** Hours between reports. Accepted for the upcoming recurring delivery; today the report is sent once. */
  @IsInt()
  @IsIn(REPORT_PERIODS)
  period!: (typeof REPORT_PERIODS)[number];
}
