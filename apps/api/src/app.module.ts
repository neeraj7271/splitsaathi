import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { ConsentsModule } from './modules/consents';
import { ContactsModule } from './modules/contacts/contacts.module';
import { GroupsModule } from './modules/groups/groups.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { EntitlementsModule } from './modules/entitlements';
import { FinancialLedgerModule } from './modules/ledger/financial-ledger.module';
import { ApiConfigModule } from './config/api-config.module';
import { ApiConfigService } from './config/api-config.service';
import { createTypeOrmOptions } from './config/typeorm.options';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ApiConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ApiConfigModule],
      inject: [ApiConfigService],
      useFactory: (config: ApiConfigService) => createTypeOrmOptions(config.env)
    }),
    UsersModule,
    AuthModule,
    ConsentsModule,
    ContactsModule,
    GroupsModule,
    NotificationsModule,
    EntitlementsModule,
    ObservabilityModule,
    JobsModule,
    FinancialLedgerModule.forRoot({ eventStore: 'postgres' })
  ]
})
export class AppModule {}
