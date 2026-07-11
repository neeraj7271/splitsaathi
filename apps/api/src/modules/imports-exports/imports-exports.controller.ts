import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request';
import { FINANCIAL_AUTHORIZATION, type FinancialAuthorizationPort } from '../ledger/financial-authorization';
import { BANK_IMPORT_PROVIDER, type BankImportProviderPort, type BankTransaction } from './bank-import-provider.port';
import { CsvExportService } from './csv-export.service';
import { ImportsExportsProjector } from './imports-exports.projector';
import { SplitwiseImportService } from './splitwise-import.service';
import type {
  CreateBankAaConsentCommand,
  CreateBankAaImportCommand,
  CommitImportCommand,
  CreateBankCsvImportCommand,
  CreateExportCommand,
  CreateSplitwiseCsvImportCommand
} from './imports-exports.types';

const supportedExportTypes: CreateExportCommand['exportType'][] = [
  'expenses_csv',
  'balances_csv',
  'full_group_csv',
  'group_pdf',
  'tally_csv',
  'settlement_certificate',
  'data_portability_json'
];

@ApiTags('imports-exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ImportsExportsController {
  constructor(
    private readonly imports: SplitwiseImportService,
    private readonly exportsService: CsvExportService,
    private readonly projection: ImportsExportsProjector,
    @Inject(BANK_IMPORT_PROVIDER) private readonly bankImportProvider: BankImportProviderPort,
    @Inject(FINANCIAL_AUTHORIZATION) private readonly authorization: FinancialAuthorizationPort
  ) {}

  @Post('imports/splitwise')
  createSplitwiseImport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateSplitwiseCsvImportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SplitwiseImportService['createImport']> {
    return this.createSplitwiseImportAsync(currentUser, idempotencyKey, dto);
  }

  private async createSplitwiseImportAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateSplitwiseCsvImportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SplitwiseImportService['createImport']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.create');
    return this.imports.createImport({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Post('imports/bank/csv')
  createBankCsvImport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateBankCsvImportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SplitwiseImportService['createBankCsvImport']> {
    return this.createBankCsvImportAsync(currentUser, idempotencyKey, dto);
  }

  private async createBankCsvImportAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateBankCsvImportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SplitwiseImportService['createBankCsvImport']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.create');
    return this.imports.createBankCsvImport({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Post('imports/bank/aa/consents')
  createBankAaConsent(@Body() dto: CreateBankAaConsentCommand) {
    return this.bankImportProvider.createConsent(dto);
  }

  @Post('imports/bank/aa/transactions')
  createBankAaImport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateBankAaImportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SplitwiseImportService['createBankCsvImport']> {
    return this.createBankAaImportAsync(currentUser, idempotencyKey, dto);
  }

  private async createBankAaImportAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateBankAaImportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<SplitwiseImportService['createBankCsvImport']> {
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'expense.create');
    const transactions = await this.bankImportProvider.fetchTransactions({
      consentId: dto.consentId,
      fromDate: dto.fromDate,
      toDate: dto.toDate
    });
    return this.imports.createBankCsvImport({
      groupId: dto.groupId,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto),
      csv: transactionsToBankCsv(transactions),
      accountParticipantId: dto.accountParticipantId,
      counterpartyParticipantId: dto.counterpartyParticipantId,
      defaultCurrencyCode: dto.defaultCurrencyCode
    });
  }

  @Post('imports/:id/commit')
  commitImport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') importJobId: string,
    @Body() dto: Omit<CommitImportCommand, 'actorId' | 'idempotencyKey' | 'importJobId'>
  ): ReturnType<SplitwiseImportService['commitImport']> {
    return this.commitImportAsync(currentUser, idempotencyKey, importJobId, dto);
  }

  private async commitImportAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    importJobId: string,
    dto: Omit<CommitImportCommand, 'actorId' | 'idempotencyKey' | 'importJobId'>
  ): ReturnType<SplitwiseImportService['commitImport']> {
    const job = this.projection.getImportJob(importJobId);
    if (job) {
      await this.authorization.assertCan(currentUser.userId, job.groupId, 'expense.create');
    }
    return this.imports.commitImport({
      ...dto,
      importJobId,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Get('imports/:id')
  async getImport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') importJobId: string
  ): Promise<ReturnType<ImportsExportsProjector['getImportJob']>> {
    const job = this.projection.getImportJob(importJobId);
    if (job) {
      await this.authorization.assertCan(currentUser.userId, job.groupId, 'read');
    }
    return job;
  }

  @Post('exports')
  createExport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: Omit<CreateExportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<CsvExportService['createExport']> {
    return this.createExportAsync(currentUser, idempotencyKey, dto);
  }

  private async createExportAsync(
    currentUser: AuthenticatedUser,
    idempotencyKey: string | undefined,
    dto: Omit<CreateExportCommand, 'actorId' | 'idempotencyKey'>
  ): ReturnType<CsvExportService['createExport']> {
    if (!supportedExportTypes.includes(dto.exportType)) {
      throw new BadRequestException(`Unsupported exportType ${String(dto.exportType)}.`);
    }
    await this.authorization.assertCan(currentUser.userId, dto.groupId, 'export');
    return this.exportsService.createExport({
      ...dto,
      actorId: currentUser.userId,
      idempotencyKey: this.requireIdempotencyKey(idempotencyKey, dto)
    });
  }

  @Get('exports/:id')
  async getExport(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') exportJobId: string
  ): Promise<ReturnType<ImportsExportsProjector['getExportJob']>> {
    const job = this.projection.getExportJob(exportJobId);
    if (job) {
      await this.authorization.assertCan(currentUser.userId, job.groupId, 'export');
    }
    return job;
  }

  private requireIdempotencyKey(headerValue: string | undefined, body: unknown): string {
    const bodyValue = (body as { idempotencyKey?: string }).idempotencyKey;
    const key = headerValue ?? bodyValue;
    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required.');
    }
    return key;
  }
}

function transactionsToBankCsv(transactions: BankTransaction[]): string {
  const rows = [['date', 'narration', 'amount', 'currency', 'type', 'transaction_id']];
  for (const transaction of transactions) {
    rows.push([
      transaction.date,
      transaction.narration,
      (transaction.amountMinor / 100).toFixed(2),
      transaction.currencyCode,
      transaction.direction,
      transaction.transactionId
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
