export const BANK_IMPORT_PROVIDER = Symbol('BANK_IMPORT_PROVIDER');

export interface BankImportConsentInput {
  customerReference: string;
  phoneNumber?: string;
  redirectUrl?: string;
  fromDate: string;
  toDate: string;
}

export interface BankImportConsentSession {
  provider: 'setu_aa';
  consentId: string;
  status: 'created' | 'pending' | 'approved' | 'rejected' | 'expired';
  redirectUrl?: string;
  rawPayload: Record<string, unknown>;
}

export interface BankTransaction {
  transactionId: string;
  date: string;
  narration: string;
  amountMinor: number;
  currencyCode: string;
  direction: 'debit' | 'credit';
  balanceMinor?: number;
  rawPayload: Record<string, unknown>;
}

export interface BankImportProviderPort {
  createConsent(input: BankImportConsentInput): Promise<BankImportConsentSession>;
  fetchTransactions(input: { consentId: string; fromDate: string; toDate: string }): Promise<BankTransaction[]>;
}

export class CsvOnlyBankImportProvider implements BankImportProviderPort {
  async createConsent(): Promise<BankImportConsentSession> {
    throw new Error('BANK_IMPORT_PROVIDER_DRIVER=setu_aa is required for Account Aggregator consent flows.');
  }

  async fetchTransactions(): Promise<BankTransaction[]> {
    throw new Error('BANK_IMPORT_PROVIDER_DRIVER=setu_aa is required for Account Aggregator transaction fetches.');
  }
}
