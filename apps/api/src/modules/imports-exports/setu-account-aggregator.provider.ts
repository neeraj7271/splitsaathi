import { Injectable } from '@nestjs/common';
import { ApiConfigService } from '../../config/api-config.service';
import type {
  BankImportConsentInput,
  BankImportConsentSession,
  BankImportProviderPort,
  BankTransaction
} from './bank-import-provider.port';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

@Injectable()
export class SetuAccountAggregatorProvider implements BankImportProviderPort {
  private fetchFn: FetchLike = fetch;

  constructor(private readonly config: ApiConfigService) {}

  static withFetch(config: ApiConfigService, fetchFn: FetchLike): SetuAccountAggregatorProvider {
    const provider = new SetuAccountAggregatorProvider(config);
    provider.fetchFn = fetchFn;
    return provider;
  }

  async createConsent(input: BankImportConsentInput): Promise<BankImportConsentSession> {
    const response = await this.request('/consents', {
      method: 'POST',
      body: JSON.stringify({
        customerReference: input.customerReference,
        phoneNumber: input.phoneNumber,
        redirectUrl: input.redirectUrl,
        dateRange: {
          from: input.fromDate,
          to: input.toDate
        },
        purpose: 'SplitSaathi expense import'
      })
    });
    const payload = (await response.json()) as Record<string, unknown>;
    const consentId = readString(payload, ['consentId', 'id', 'sessionId']);
    if (!consentId) {
      throw new Error('Setu AA consent response did not include a consent id.');
    }
    return {
      provider: 'setu_aa',
      consentId,
      status: mapConsentStatus(readString(payload, ['status', 'state'])),
      redirectUrl: readString(payload, ['redirectUrl', 'url']),
      rawPayload: payload
    };
  }

  async fetchTransactions(input: { consentId: string; fromDate: string; toDate: string }): Promise<BankTransaction[]> {
    const params = new URLSearchParams({ from: input.fromDate, to: input.toDate });
    const response = await this.request(`/consents/${encodeURIComponent(input.consentId)}/transactions?${params.toString()}`, {
      method: 'GET'
    });
    const payload = (await response.json()) as Record<string, unknown>;
    const rows = Array.isArray(payload.transactions)
      ? payload.transactions
      : Array.isArray(payload.data)
        ? payload.data
        : [];
    return rows.map((row, index) => normalizeTransaction(row as Record<string, unknown>, index));
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const clientId = this.config.env.SETU_AA_CLIENT_ID;
    const clientSecret = this.config.env.SETU_AA_CLIENT_SECRET;
    const baseUrl = this.config.env.SETU_AA_BASE_URL?.replace(/\/$/, '');
    if (!baseUrl || !clientId || !clientSecret) {
      throw new Error('SETU_AA_BASE_URL, SETU_AA_CLIENT_ID, and SETU_AA_CLIENT_SECRET are required for BANK_IMPORT_PROVIDER_DRIVER=setu_aa.');
    }
    const response = await this.fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`Setu AA request failed with status ${response.status}.`);
    }
    return response;
  }
}

function normalizeTransaction(row: Record<string, unknown>, index: number): BankTransaction {
  const amountMajor = Number(readString(row, ['amount', 'transactionAmount', 'value']) ?? '0');
  const direction = /^cr|credit|deposit$/i.test(readString(row, ['direction', 'type']) ?? '') ? 'credit' : 'debit';
  return {
    transactionId: readString(row, ['transactionId', 'id', 'txnId']) ?? `setu-aa-row-${index + 1}`,
    date: readString(row, ['date', 'transactionDate', 'valueDate']) ?? new Date().toISOString().slice(0, 10),
    narration: readString(row, ['narration', 'description', 'merchant', 'counterparty']) ?? 'Bank transaction',
    amountMinor: Math.round(Math.abs(amountMajor) * 100),
    currencyCode: readString(row, ['currency', 'currencyCode']) ?? 'INR',
    direction,
    balanceMinor: row.balance === undefined ? undefined : Math.round(Number(row.balance) * 100),
    rawPayload: row
  };
}

function readString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return undefined;
}

function mapConsentStatus(value?: string): BankImportConsentSession['status'] {
  if (!value) return 'created';
  if (/approved|active|ready/i.test(value)) return 'approved';
  if (/reject|deny|fail/i.test(value)) return 'rejected';
  if (/expire/i.test(value)) return 'expired';
  if (/pending|await/i.test(value)) return 'pending';
  return 'created';
}
