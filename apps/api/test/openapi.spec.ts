import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { GroupsController } from '../src/modules/groups/groups.controller';
import { GroupsService } from '../src/modules/groups/groups.service';
import { ExpensesController } from '../src/modules/expenses';
import { ExpenseCommandService } from '../src/modules/expenses/expense-command.service';
import { ImportsExportsProjector } from '../src/modules/imports-exports';
import { ExpenseProjector } from '../src/modules/ledger';
import { FINANCIAL_AUTHORIZATION } from '../src/modules/ledger/financial-authorization';
import { OfflineCommandSyncService, OfflineSyncController } from '../src/modules/offline-sync';
import { ReceiptsCaptureController, ReceiptsCaptureService } from '../src/modules/receipts-capture';
import { RecurringProjector } from '../src/modules/recurring';
import {
  SettlementCommandService,
  SettlementProjector,
  SettlementSuggestionService,
  SettlementsController
} from '../src/modules/settlements';

describe('OpenAPI document', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/splitsaathi_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-123456';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-123456';
    process.env.OTP_DEV_CODE = '123456';
    process.env.APP_PUBLIC_URL = 'http://localhost:3000';
    process.env.MOBILE_API_URL = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        GroupsController,
        ExpensesController,
        SettlementsController,
        ReceiptsCaptureController,
        OfflineSyncController
      ],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: GroupsService, useValue: {} },
        { provide: ExpenseCommandService, useValue: {} },
        { provide: ExpenseProjector, useValue: {} },
        { provide: SettlementCommandService, useValue: {} },
        { provide: SettlementProjector, useValue: {} },
        { provide: SettlementSuggestionService, useValue: {} },
        { provide: ReceiptsCaptureService, useValue: {} },
        { provide: OfflineCommandSyncService, useValue: {} },
        { provide: ImportsExportsProjector, useValue: {} },
        { provide: RecurringProjector, useValue: {} },
        { provide: FINANCIAL_AUTHORIZATION, useValue: { assertCan: jest.fn() } }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('publishes the core Phase 1 route surface', () => {
    const config = new DocumentBuilder()
      .setTitle('SplitSaathi API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths).toHaveProperty('/v1/auth/otp/start');
    expect(document.paths).toHaveProperty('/v1/groups');
    expect(document.paths).toHaveProperty('/v1/expenses');
    expect(document.paths).toHaveProperty('/v1/settlement-intents');
    expect(document.paths).toHaveProperty('/v1/attachments');
    expect(document.paths).toHaveProperty('/v1/commands/batch');
  });
});
