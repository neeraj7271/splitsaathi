import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiConfigModule } from '../../config/api-config.module';
import { BalanceProjectorModule } from '../ledger/balance-projector.module';
import { GroupsModule } from '../groups/groups.module';
import { UsersModule } from '../users/users.module';
import { CronSecretGuard } from './cron-secret.guard';
import { JobsController } from './jobs.controller';
import { MonthlySummaryMailService } from './monthly-summary-mail.service';

@Module({
  imports: [ApiConfigModule, AuthModule, GroupsModule, UsersModule, BalanceProjectorModule],
  controllers: [JobsController],
  providers: [MonthlySummaryMailService, CronSecretGuard],
  exports: [MonthlySummaryMailService]
})
export class JobsModule {}
