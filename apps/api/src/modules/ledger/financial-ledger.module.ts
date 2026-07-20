import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceProjectorModule } from './balance-projector.module';
import {
  AttachmentEntity,
  CaptureJobEntity,
  EventStoreEntity,
  IdempotencyRecordEntity,
  LedgerPostingEntity,
  ReceiptDraftItemEntity,
  ReceiptDraftEntity,
  ReceiptOcrResultEntity,
  ReminderScheduleEntity
} from '@splitsaathi/db';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiConfigModule } from '../../config/api-config.module';
import { ApiConfigService } from '../../config/api-config.service';
import { ActivityController } from '../activity';
import { BalanceQueryService, BalancesController } from '../balances';
import { CurrencyController, FxRateService } from '../currency';
import { ExpenseAllocationService, ExpenseCommandService, ExpensesController } from '../expenses';
import { GroupsModule } from '../groups/groups.module';
import {
  BANK_IMPORT_PROVIDER,
  CsvExportService,
  CsvOnlyBankImportProvider,
  ImportsExportsController,
  ImportsExportsProjector,
  SetuAccountAggregatorProvider,
  SplitwiseImportService
} from '../imports-exports';
import { OfflineCommandSyncService, OfflineSyncController } from '../offline-sync';
import {
  LocalObjectStorageProvider,
  NoopOcrProvider,
  OBJECT_STORAGE_PROVIDER,
  OCR_PROVIDER,
  ReceiptsCaptureController,
  ReceiptsCaptureService,
  S3ObjectStorageProvider,
  TesseractOcrProvider
} from '../receipts-capture';
import { RecurringController, RecurringExpenseService, RecurringProjector, ReminderScheduleService } from '../recurring';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import {
  DevUpiIntentProvider,
  ManualPaymentGateway,
  PAYMENT_GATEWAY_PROVIDER,
  PaymentWebhookController,
  RazorpayPaymentGatewayProvider,
  SettlementCommandService,
  SettlementProjector,
  SettlementSuggestionService,
  SettlementsController,
  UPI_INTENT_PROVIDER
} from '../settlements';
import { ActivityProjector } from './activity.projector';
import { BalanceProjector } from './balance.projector';
import { InMemoryEventStore } from './event-store';
import { ExpenseProjector } from './expense.projector';
import {
  AllowAllFinancialAuthorization,
  FINANCIAL_AUTHORIZATION,
  GroupsFinancialAuthorization
} from './financial-authorization';
import { LedgerService } from './ledger.service';
import { LEDGER_EVENT_STORE } from './ledger.types';
import { PostgresEventStore } from './postgres-event-store';
import { ProjectionRunner } from './projection-runner';

const controllers = [
  ExpensesController,
  BalancesController,
  CurrencyController,
  SettlementsController,
  PaymentWebhookController,
  ImportsExportsController,
  RecurringController,
  OfflineSyncController,
  ActivityController,
  ReceiptsCaptureController,
  ReportsController
];

const sharedProviders: Provider[] = [
  JwtAuthGuard,
  ExpenseProjector,
  ActivityProjector,
  SettlementProjector,
  ImportsExportsProjector,
  CsvOnlyBankImportProvider,
  SetuAccountAggregatorProvider,
  RecurringProjector,
  ReportsService,
  ExpenseAllocationService,
  FxRateService,
  ReminderScheduleService,
  ReceiptsCaptureService,
  NoopOcrProvider,
  TesseractOcrProvider,
  LocalObjectStorageProvider,
  S3ObjectStorageProvider,
  {
    provide: BANK_IMPORT_PROVIDER,
    inject: [ApiConfigService, CsvOnlyBankImportProvider, SetuAccountAggregatorProvider],
    useFactory: (
      config: ApiConfigService,
      csvOnly: CsvOnlyBankImportProvider,
      setu: SetuAccountAggregatorProvider
    ) => (config.env.BANK_IMPORT_PROVIDER_DRIVER === 'setu_aa' ? setu : csvOnly)
  },
  {
    provide: OCR_PROVIDER,
    inject: [ApiConfigService, NoopOcrProvider, TesseractOcrProvider],
    useFactory: (config: ApiConfigService, noop: NoopOcrProvider, tesseract: TesseractOcrProvider) =>
      config.env.OCR_PROVIDER_DRIVER === 'tesseract' ? tesseract : noop
  },
  {
    provide: OBJECT_STORAGE_PROVIDER,
    inject: [ApiConfigService, LocalObjectStorageProvider, S3ObjectStorageProvider],
    useFactory: (
      config: ApiConfigService,
      local: LocalObjectStorageProvider,
      s3: S3ObjectStorageProvider
    ) => {
      if (config.env.NODE_ENV === 'production' && config.env.OBJECT_STORAGE_DRIVER === 'local') {
        throw new Error('OBJECT_STORAGE_DRIVER=local is not allowed in production.');
      }
      return config.env.OBJECT_STORAGE_DRIVER === 's3' ? s3 : local;
    }
  },
  DevUpiIntentProvider,
  ManualPaymentGateway,
  RazorpayPaymentGatewayProvider,
  {
    provide: UPI_INTENT_PROVIDER,
    inject: [ApiConfigService, DevUpiIntentProvider],
    useFactory: (config: ApiConfigService, dev: DevUpiIntentProvider) => {
      if (config.env.NODE_ENV === 'production' && config.env.UPI_INTENT_PROVIDER_DRIVER === 'dev') {
        return dev;
      }
      return dev;
    }
  },
  {
    provide: PAYMENT_GATEWAY_PROVIDER,
    inject: [ApiConfigService, ManualPaymentGateway, RazorpayPaymentGatewayProvider],
    useFactory: (
      config: ApiConfigService,
      manual: ManualPaymentGateway,
      razorpay: RazorpayPaymentGatewayProvider
    ) => {
      if (config.env.NODE_ENV === 'production' && config.env.PAYMENT_GATEWAY_DRIVER === 'manual') {
        throw new Error('PAYMENT_GATEWAY_DRIVER=manual is not allowed in production.');
      }
      return config.env.PAYMENT_GATEWAY_DRIVER === 'razorpay' ? razorpay : manual;
    }
  },
  {
    provide: ProjectionRunner,
    inject: [
      BalanceProjector,
      ExpenseProjector,
      ActivityProjector,
      SettlementProjector,
      ImportsExportsProjector,
      RecurringProjector
    ],
    useFactory: (
      balances: BalanceProjector,
      expenses: ExpenseProjector,
      activity: ActivityProjector,
      settlements: SettlementProjector,
      importsExports: ImportsExportsProjector,
      recurring: RecurringProjector
    ) => new ProjectionRunner([balances, expenses, activity, settlements, importsExports, recurring])
  },
  {
    provide: LedgerService,
    inject: [LEDGER_EVENT_STORE, ProjectionRunner],
    useFactory: (eventStore: InMemoryEventStore | PostgresEventStore, projections: ProjectionRunner) =>
      new LedgerService(eventStore, projections)
  },
  {
    provide: ExpenseCommandService,
    inject: [LedgerService, ExpenseProjector, ExpenseAllocationService],
    useFactory: (ledger: LedgerService, expenses: ExpenseProjector, allocation: ExpenseAllocationService) =>
      new ExpenseCommandService(ledger, expenses, allocation)
  },
  {
    provide: BalanceQueryService,
    inject: [BalanceProjector],
    useFactory: (balances: BalanceProjector) => new BalanceQueryService(balances)
  },
  {
    provide: SettlementSuggestionService,
    inject: [BalanceProjector, ExpenseProjector],
    useFactory: (balances: BalanceProjector, expenses: ExpenseProjector) =>
      new SettlementSuggestionService(balances, expenses)
  },
  {
    provide: SettlementCommandService,
    inject: [LedgerService, SettlementProjector, UPI_INTENT_PROVIDER, PAYMENT_GATEWAY_PROVIDER],
    useFactory: (
      ledger: LedgerService,
      settlements: SettlementProjector,
      upi: DevUpiIntentProvider,
      gateway: ManualPaymentGateway
    ) => new SettlementCommandService(ledger, settlements, upi, gateway)
  },
  {
    provide: SplitwiseImportService,
    inject: [LedgerService, ImportsExportsProjector, ExpenseCommandService],
    useFactory: (ledger: LedgerService, projection: ImportsExportsProjector, expenses: ExpenseCommandService) =>
      new SplitwiseImportService(ledger, projection, expenses)
  },
  {
    provide: CsvExportService,
    inject: [LedgerService, ImportsExportsProjector, ExpenseProjector, BalanceProjector],
    useFactory: (
      ledger: LedgerService,
      projection: ImportsExportsProjector,
      expenses: ExpenseProjector,
      balances: BalanceProjector
    ) => new CsvExportService(ledger, projection, expenses, balances)
  },
  {
    provide: RecurringExpenseService,
    inject: [LedgerService, RecurringProjector, ExpenseCommandService],
    useFactory: (ledger: LedgerService, recurring: RecurringProjector, expenses: ExpenseCommandService) =>
      new RecurringExpenseService(ledger, recurring, expenses)
  },
  {
    provide: OfflineCommandSyncService,
    inject: [
      LedgerService,
      ExpenseCommandService,
      SettlementCommandService,
      SplitwiseImportService,
      CsvExportService,
      RecurringExpenseService
    ],
    useFactory: (
      ledger: LedgerService,
      expenses: ExpenseCommandService,
      settlements: SettlementCommandService,
      imports: SplitwiseImportService,
      exportsService: CsvExportService,
      recurring: RecurringExpenseService
    ) => new OfflineCommandSyncService(ledger, expenses, settlements, imports, exportsService, recurring)
  }
];

const exportsList = [
  LedgerService,
  BalanceQueryService,
  ExpenseCommandService,
  SettlementCommandService,
  SettlementSuggestionService,
  SplitwiseImportService,
  CsvExportService,
  RecurringExpenseService,
  OfflineCommandSyncService,
  ReceiptsCaptureService,
  ReminderScheduleService
];

@Module({
  imports: [ApiConfigModule, JwtModule.register({}), BalanceProjectorModule],
  controllers,
  providers: [
    InMemoryEventStore,
    {
      provide: LEDGER_EVENT_STORE,
      useExisting: InMemoryEventStore
    },
    {
      provide: FINANCIAL_AUTHORIZATION,
      useClass: AllowAllFinancialAuthorization
    },
    ...sharedProviders
  ],
  exports: exportsList
})
export class FinancialLedgerModule {
  static forRoot(options: { eventStore?: 'in-memory' | 'postgres' } = {}): DynamicModule {
    if (options.eventStore !== 'postgres') {
      return {
        module: FinancialLedgerModule,
        imports: [ApiConfigModule, JwtModule.register({}), BalanceProjectorModule],
        controllers,
        providers: [
          InMemoryEventStore,
          {
            provide: LEDGER_EVENT_STORE,
            useExisting: InMemoryEventStore
          },
          {
            provide: FINANCIAL_AUTHORIZATION,
            useClass: AllowAllFinancialAuthorization
          },
          ...sharedProviders
        ],
        exports: exportsList
      };
    }

    return {
      module: FinancialLedgerModule,
      imports: [
        ApiConfigModule,
        JwtModule.register({}),
        BalanceProjectorModule,
        GroupsModule,
        TypeOrmModule.forFeature([
          EventStoreEntity,
          LedgerPostingEntity,
          IdempotencyRecordEntity,
          ReminderScheduleEntity,
          AttachmentEntity,
          ReceiptDraftEntity,
          ReceiptOcrResultEntity,
          ReceiptDraftItemEntity,
          CaptureJobEntity
        ])
      ],
      controllers,
      providers: [
        PostgresEventStore,
        {
          provide: LEDGER_EVENT_STORE,
          useExisting: PostgresEventStore
        },
        GroupsFinancialAuthorization,
        {
          provide: FINANCIAL_AUTHORIZATION,
          useExisting: GroupsFinancialAuthorization
        },
        ...sharedProviders
      ],
      exports: exportsList
    };
  }
}
