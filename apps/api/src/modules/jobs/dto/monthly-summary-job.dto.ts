import { IsEmail, IsOptional } from 'class-validator';

/** Optional body for cron job endpoints. When `testEmail` is set, only that user receives real summaries. */
export class MonthlySummaryJobDto {
  @IsOptional()
  @IsEmail()
  testEmail?: string;
}
