import {
  ActivityRowDto,
  AuditEntry,
  BalanceRow,
  ExportJob,
  ExpenseRow,
  GroupDetail,
  GroupMode,
  GroupSummary,
  ImportJob,
  MembershipRole,
  RecurringSchedule,
  SettlementIntent,
  SettlementSuggestion,
  StartOtpResponse,
  VerifyOtpResponse
} from "../types/domain";
import { createIdempotencyKey } from "../utils/idempotency";
import { getAccessToken, getRefreshToken, setTokens } from "../auth/tokenStore";

const DEFAULT_API_URL = "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  idempotencyKey?: string;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

export interface CreateGroupRequest {
  name: string;
  mode: GroupMode;
  baseCurrencyCode: string;
  participants: Array<{
    displayName: string;
    phoneE164?: string;
    role: Exclude<MembershipRole, "owner">;
  }>;
}

export interface CreateExpenseRequest {
  groupId: string;
  description: string;
  category?: string;
  expenseDate: string;
  currencyCode: string;
  payers: Array<{ participantId: string; amountMinor: number }>;
  shares: Array<{
    participantId: string;
    shareType: "equal" | "exact" | "percent" | "weight" | "itemized";
    amountMinor?: number;
    weightNumerator?: number;
    weightDenominator?: number;
  }>;
  lineItems?: Array<{
    label: string;
    amountMinor: number;
    participantIds: string[];
  }>;
  billAdjustments?: Array<{
    adjustmentType: "tax" | "gst_cgst" | "gst_sgst" | "service_charge" | "tip" | "discount" | "rounding";
    label: string;
    amountMinor: number;
    allocationBasis: "subtotal_proportional" | "equal" | "manual" | "taxable_items_only";
  }>;
}

export interface BatchCommand {
  clientMutationId: string;
  idempotencyKey: string;
  commandType: string;
  payload: Record<string, unknown>;
  expectedAggregateVersion?: number;
}

type ExpenseCommandResponse = { expense: Record<string, any>; events?: unknown[] };
type SettlementCommandResponse = { intent: Record<string, any>; events?: unknown[] };
type RecurringCommandResponse = { schedule: Record<string, any>; events?: unknown[] };
export type OfflineCommandResult = {
  clientMutationId: string;
  commandType: string;
  status: "accepted" | "conflict" | "failed";
  eventIds: string[];
  globalPositions: number[];
  error?: string;
};
export type OfflineCommandBatchResponse = {
  results: OfflineCommandResult[];
  events: unknown[];
  nextCursor: number;
};

function mapExpense(row: Record<string, any>): ExpenseRow {
  return {
    id: row.id ?? row.expenseId,
    groupId: row.groupId,
    description: row.description,
    category: row.category,
    expenseDate: row.expenseDate,
    totalAmountMinor: row.totalAmountMinor,
    currencyCode: row.currencyCode,
    state: row.state ?? row.status,
    currentVersion: row.currentVersion ?? row.version,
    updatedAt: row.updatedAt
  };
}

function mapSettlementIntent(row: Record<string, any>): SettlementIntent {
  return {
    id: row.id ?? row.settlementIntentId,
    groupId: row.groupId,
    payerParticipantId: row.payerParticipantId,
    payeeParticipantId: row.payeeParticipantId,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    state: row.state,
    upiUri: row.upiUri,
    qrPayload: row.qrPayload,
    clientReference: row.clientReference ?? row.providerReference,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt
  };
}

function mapRecurringSchedule(row: Record<string, any>): RecurringSchedule {
  const payerTotal = Array.isArray(row.template?.payers)
    ? row.template.payers.reduce((sum: number, payer: { amountMinor?: number }) => sum + (payer.amountMinor ?? 0), 0)
    : row.amountMinor ?? 0;
  return {
    id: row.id ?? row.recurringScheduleId,
    groupId: row.groupId,
    title: row.title ?? row.template?.description ?? "Recurring bill",
    amountMinor: payerTotal,
    currencyCode: row.currencyCode ?? row.template?.currencyCode ?? "INR",
    frequency: row.frequency ?? row.cadence,
    state: row.state ?? row.status,
    nextRunAt: row.nextRunAt ?? row.nextRunDate,
    reminderDaysBefore: row.reminderDaysBefore
  };
}

function mapImportJob(row: Record<string, any>): ImportJob {
  return {
    id: row.id ?? row.importJobId,
    source: row.source ?? "splitwise_csv",
    state: row.state ?? row.status,
    summary: row.summary
  };
}

function mapExportJob(row: Record<string, any>): ExportJob {
  return {
    id: row.id ?? row.exportJobId,
    exportType: row.exportType,
    state: row.state ?? row.status,
    fileUrl: row.fileUrl,
    data: row.data,
    contentType: row.contentType
  };
}

export class SplitSaathiApiClient {
  private baseUrl: string;

  constructor(baseUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async startOtp(phoneE164: string) {
    return this.request<StartOtpResponse>("/v1/auth/otp/start", {
      method: "POST",
      body: { phoneE164 },
      skipAuth: true
    });
  }

  async verifyOtp(challengeId: string, code: string, displayName?: string) {
    const response = await this.request<VerifyOtpResponse>("/v1/auth/otp/verify", {
      method: "POST",
      body: { challengeId, code, displayName },
      skipAuth: true
    });
    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);

    return response;
  }

  async refresh() {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new ApiError(401, "No refresh token available", null);
    }

    const response = await this.request<VerifyOtpResponse>("/v1/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      skipAuth: true,
      retryOnUnauthorized: false
    });
    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);

    return response;
  }

  async recordConsent(purpose: "contacts_discovery" | "receipt_upload" | "upi_proof_storage" | "notification_delivery", granted: boolean) {
    return this.request<{ id: string }>("/v1/consents", {
      method: "POST",
      body: {
        purpose,
        status: granted ? "granted" : "revoked",
        source: "onboarding"
      }
    });
  }

  async registerDeviceInstallation(payload: { platform: "ios" | "android"; appVersion?: string; pushToken?: string }) {
    return this.request<{ id: string }>("/v1/device-installations", {
      method: "POST",
      body: payload
    });
  }

  async listGroups() {
    return this.request<GroupSummary[]>("/v1/groups");
  }

  async getGroup(groupId: string) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}`);
  }

  async createGroup(payload: CreateGroupRequest, idempotencyKey = createIdempotencyKey("group.create")) {
    return this.request<GroupDetail>("/v1/groups", {
      method: "POST",
      body: payload,
      idempotencyKey
    });
  }

  async createInvite(groupId: string) {
    const invite = await this.request<{ id: string; joinUrl: string; token: string }>(`/v1/groups/${groupId}/invites`, {
      method: "POST",
      body: {}
    });
    return { ...invite, inviteId: invite.id, inviteUrl: invite.joinUrl };
  }

  async previewInvite(tokenOrUrl: string) {
    const token = extractInviteToken(tokenOrUrl);
    return this.request<{ id: string; groupId: string; joinUrl: string; token: string }>(`/v1/groups/invites/${encodeURIComponent(token)}`, {
      skipAuth: true
    });
  }

  async claimInvite(tokenOrUrl: string, displayName?: string) {
    const token = extractInviteToken(tokenOrUrl);
    return this.request<GroupDetail>(`/v1/groups/invites/${encodeURIComponent(token)}/claim`, {
      method: "POST",
      body: { displayName }
    });
  }

  async addParticipant(groupId: string, displayName: string, phoneE164?: string) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}/participants`, {
      method: "POST",
      body: { displayName, phoneE164 }
    });
  }

  async updateMembershipRole(groupId: string, membershipId: string, role: MembershipRole) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}/memberships/${membershipId}/role`, {
      method: "PATCH",
      body: { role }
    });
  }

  async archiveGroup(groupId: string) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}/archive`, {
      method: "POST",
      body: {}
    });
  }

  async lockMemberExit(groupId: string, membershipId: string) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}/memberships/${membershipId}/lock-exit`, {
      method: "POST",
      body: {}
    });
  }

  async transferObligation(groupId: string, fromParticipantId: string, toParticipantId: string, reason: string) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}/obligation-transfers`, {
      method: "POST",
      body: { fromParticipantId, toParticipantId, reason }
    });
  }

  async listExpenses(groupId: string) {
    const rows = await this.request<Array<Record<string, any>>>(`/v1/groups/${groupId}/expenses`);
    return rows.map(mapExpense);
  }

  async createExpense(payload: CreateExpenseRequest, idempotencyKey = createIdempotencyKey("expense.create")) {
    const response = await this.request<ExpenseCommandResponse>("/v1/expenses", {
      method: "POST",
      body: payload,
      idempotencyKey
    });
    return mapExpense(response.expense);
  }

  async reviseExpense(expenseId: string, payload: CreateExpenseRequest & { baseVersion: number; reason: string }) {
    const response = await this.request<ExpenseCommandResponse>(`/v1/expenses/${expenseId}/revisions`, {
      method: "POST",
      body: { ...payload, expectedVersion: payload.baseVersion },
      idempotencyKey: createIdempotencyKey("expense.revision")
    });
    return mapExpense(response.expense);
  }

  async voidExpense(expenseId: string, reason: string, groupId?: string, baseVersion?: number) {
    const response = await this.request<ExpenseCommandResponse>(`/v1/expenses/${expenseId}/void`, {
      method: "POST",
      body: { reason, groupId, expectedVersion: baseVersion },
      idempotencyKey: createIdempotencyKey("expense.void")
    });
    return response.expense ? mapExpense(response.expense) : undefined;
  }

  async getExpenseHistory(expenseId: string) {
    const rows = await this.request<Array<Record<string, any>>>(`/v1/expenses/${expenseId}/history`);
    return rows.map((row) => ({
      id: row.eventId ?? row.id,
      version: row.version,
      actorName: row.actorId,
      summary: row.eventType ?? row.summary,
      reason: row.reason,
      createdAt: row.occurredAt ?? row.createdAt
    }));
  }

  async getGroupActivity(groupId: string) {
    const rows = await this.request<Array<Record<string, any>>>(`/v1/groups/${groupId}/activity`);
    return rows.map((row) => ({
      id: row.id ?? row.eventId,
      groupId: row.groupId,
      activityType: row.activityType ?? row.type,
      title: row.title,
      body: row.body,
      entityId: row.aggregateId,
      occurredAt: row.occurredAt
    }));
  }

  async getBalances(groupId: string) {
    const summary = await this.request<{ balances: Array<Record<string, any>> }>(`/v1/groups/${groupId}/balances`);
    return summary.balances.map((row) => ({
      participantId: row.participantId,
      displayName: row.displayName ?? row.participantId,
      currencyCode: row.currencyCode,
      balanceMinor: row.balanceMinor ?? row.amountMinor,
      explanation: row.explanation
    }));
  }

  async getSettlementSuggestions(groupId: string) {
    const rows = await this.request<Array<Record<string, any>>>(`/v1/groups/${groupId}/settlement-suggestions`);
    return rows.map((row, index) => ({
      id: row.id ?? `${groupId}:${index}:${row.payerParticipantId}:${row.payeeParticipantId}`,
      groupId,
      payerParticipantId: row.payerParticipantId,
      payerName: row.payerName ?? row.payerParticipantId,
      payeeParticipantId: row.payeeParticipantId,
      payeeName: row.payeeName ?? row.payeeParticipantId,
      amountMinor: row.amountMinor,
      currencyCode: row.currencyCode,
      explanation: row.explanation
    }));
  }

  async createSettlementIntent(payload: {
    groupId: string;
    payerParticipantId: string;
    payeeParticipantId: string;
    amountMinor: number;
    currencyCode: string;
    suggestionId?: string;
    preferredUpiApp?: string;
    payeeVpa?: string;
    payeeName?: string;
  }) {
    const response = await this.request<SettlementCommandResponse>("/v1/settlement-intents", {
      method: "POST",
      body: {
        ...payload,
        payeeVpa: payload.payeeVpa ?? `${payload.payeeParticipantId}@upi`,
        payeeName: payload.payeeName ?? payload.payeeParticipantId
      },
      idempotencyKey: createIdempotencyKey("settlement.intent")
    });
    return mapSettlementIntent(response.intent);
  }

  async markUpiOpened(intentId: string, appName: string) {
    const response = await this.request<SettlementCommandResponse>(`/v1/settlement-intents/${intentId}/upi/opened`, {
      method: "POST",
      body: { upiApp: appName, platform: "mobile" },
      idempotencyKey: createIdempotencyKey("settlement.upi.opened")
    });
    return mapSettlementIntent(response.intent);
  }

  async submitSettlementProof(intentId: string, payload: { utrText?: string; attachmentId?: string; claimedAmountMinor: number }) {
    const response = await this.request<SettlementCommandResponse>(`/v1/settlement-intents/${intentId}/proofs`, {
      method: "POST",
      body: {
        proofType: payload.attachmentId ? "screenshot" : "utr_text",
        utr: payload.utrText,
        attachmentId: payload.attachmentId,
        amountMinor: payload.claimedAmountMinor,
        currencyCode: "INR"
      },
      idempotencyKey: createIdempotencyKey("settlement.proof")
    });
    return mapSettlementIntent(response.intent);
  }

  async confirmSettlement(intentId: string) {
    const response = await this.request<SettlementCommandResponse>(`/v1/settlement-intents/${intentId}/confirm`, {
      method: "POST",
      body: { decision: "accept" },
      idempotencyKey: createIdempotencyKey("settlement.confirm")
    });
    return mapSettlementIntent(response.intent);
  }

  async rejectSettlement(intentId: string, reason: string) {
    const response = await this.request<SettlementCommandResponse>(`/v1/settlement-intents/${intentId}/reject`, {
      method: "POST",
      body: { reason },
      idempotencyKey: createIdempotencyKey("settlement.reject")
    });
    return mapSettlementIntent(response.intent);
  }

  async disputeSettlement(intentId: string, reason: string) {
    const response = await this.request<SettlementCommandResponse>(`/v1/settlement-intents/${intentId}/dispute`, {
      method: "POST",
      body: { reason },
      idempotencyKey: createIdempotencyKey("settlement.dispute")
    });
    return mapSettlementIntent(response.intent);
  }

  async reverseSettlement(intentId: string, reason: string) {
    const response = await this.request<SettlementCommandResponse>(`/v1/settlement-intents/${intentId}/reverse`, {
      method: "POST",
      body: { reason },
      idempotencyKey: createIdempotencyKey("settlement.reverse")
    });
    return mapSettlementIntent(response.intent);
  }

  async listSettlementHistory(groupId: string) {
    const rows = await this.request<Array<Record<string, any>>>(`/v1/groups/${groupId}/settlement-intents`);
    return rows.map(mapSettlementIntent);
  }

  async uploadAttachment(file: { uri: string; name: string; type: string }, purpose: "receipt" | "payment_proof" | "avatar" | "export") {
    const formData = new FormData();
    formData.append("purpose", purpose);
    formData.append("file", file as unknown as Blob);

    return this.request<{ id: string }>("/v1/attachments", {
      method: "POST",
      formData,
      idempotencyKey: createIdempotencyKey("attachment.upload")
    });
  }

  async createReceiptDraft(groupId: string, attachmentId?: string) {
    return this.request<{ id: string }>("/v1/receipt-drafts", {
      method: "POST",
      body: {
        groupId,
        attachmentId,
        source: attachmentId ? "gallery" : "manual_text"
      },
      idempotencyKey: createIdempotencyKey("receipt.draft")
    });
  }

  async analyzeReceiptDraft(receiptDraftId: string) {
    return this.request<{ receiptDraftId: string; provider: string; rawText: string; items: Array<{ label: string; amountMinor: number; currencyCode: string; confidence: number }> }>(
      `/v1/receipt-drafts/${receiptDraftId}/ocr`,
      {
        method: "POST",
        body: {},
        idempotencyKey: createIdempotencyKey("receipt.ocr")
      }
    );
  }

  async createCaptureJob(payload: { source: "share_sheet" | "paste" | "sms_manual" | "email_forward" | "android_notification"; rawText?: string; attachmentId?: string }) {
    return this.request<{ id: string; parsedResult: Record<string, unknown>; state: string }>("/v1/capture-jobs", {
      method: "POST",
      body: payload
    });
  }

  async postReceiptDraftExpense(receiptDraftId: string, payload: CreateExpenseRequest) {
    return this.request<ExpenseRow>(`/v1/receipt-drafts/${receiptDraftId}/post-expense`, {
      method: "POST",
      body: payload,
      idempotencyKey: createIdempotencyKey("receipt.post")
    });
  }

  async listRecurringSchedules(groupId: string) {
    const rows = await this.request<Array<Record<string, any>>>(`/v1/groups/${groupId}/recurring-schedules`);
    return rows.map(mapRecurringSchedule);
  }

  async createRecurringSchedule(payload: {
    groupId: string;
    title: string;
    amountMinor: number;
    currencyCode: string;
    frequency: "weekly" | "monthly";
    reminderDaysBefore: number;
    payerParticipantId: string;
    beneficiaryParticipantIds: string[];
  }) {
    const response = await this.request<RecurringCommandResponse>("/v1/recurring-schedules", {
      method: "POST",
      body: {
        groupId: payload.groupId,
        cadence: payload.frequency,
        startDate: new Date().toISOString().slice(0, 10),
        template: {
          description: payload.title,
          currencyCode: payload.currencyCode,
          payers: [{ participantId: payload.payerParticipantId, amountMinor: payload.amountMinor }],
          shares: payload.beneficiaryParticipantIds.map((participantId) => ({ participantId, shareType: "equal" }))
        }
      },
      idempotencyKey: createIdempotencyKey("recurring.create")
    });
    return mapRecurringSchedule(response.schedule);
  }

  async createReminderSchedule(payload: { groupId: string; type: "settlement_day" | "recurring_expense" | "stale_proof"; schedule: Record<string, unknown> }) {
    return this.request<{ id: string }>("/v1/reminder-schedules", {
      method: "POST",
      body: payload,
      idempotencyKey: createIdempotencyKey("reminder.create")
    });
  }

  async createSplitwiseImport(payload: { groupId: string; csv: string; participantNameToId: Record<string, string>; defaultCurrencyCode?: string }) {
    const response = await this.request<{ job: Record<string, any> }>("/v1/imports/splitwise", {
      method: "POST",
      body: payload,
      idempotencyKey: createIdempotencyKey("import.splitwise")
    });
    return mapImportJob(response.job);
  }

  async createBankCsvImport(payload: { groupId: string; csv: string; accountParticipantId: string; counterpartyParticipantId?: string; defaultCurrencyCode?: string }) {
    const response = await this.request<{ job: Record<string, any> }>("/v1/imports/bank/csv", {
      method: "POST",
      body: payload,
      idempotencyKey: createIdempotencyKey("import.bank")
    });
    return mapImportJob(response.job);
  }

  async getImport(importId: string) {
    return mapImportJob(await this.request<Record<string, any>>(`/v1/imports/${importId}`));
  }

  async commitImport(importId: string) {
    const response = await this.request<{ job: Record<string, any> }>(`/v1/imports/${importId}/commit`, {
      method: "POST",
      body: {},
      idempotencyKey: createIdempotencyKey("import.commit")
    });
    return mapImportJob(response.job);
  }

  async createExport(payload: { groupId?: string; exportType: ExportJob["exportType"]; parameters?: Record<string, unknown> }) {
    const response = await this.request<{ job: Record<string, any> }>("/v1/exports", {
      method: "POST",
      body: payload,
      idempotencyKey: createIdempotencyKey("export.create")
    });
    return mapExportJob(response.job);
  }

  async getExport(exportId: string) {
    return mapExportJob(await this.request<Record<string, any>>(`/v1/exports/${exportId}`));
  }

  async getSync(cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request<{ events: unknown[]; nextCursor: number }>(`/v1/sync${query}`);
  }

  async postCommandBatch(commands: BatchCommand[]) {
    return this.request<OfflineCommandBatchResponse>("/v1/commands/batch", {
      method: "POST",
      body: { commands },
      idempotencyKey: createIdempotencyKey("commands.batch")
    });
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {};

    if (!options.formData) {
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    if (!options.skipAuth) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined)
    });

    if (response.status === 401 && options.retryOnUnauthorized !== false && !options.skipAuth) {
      await this.refresh();
      return this.request<T>(path, { ...options, retryOnUnauthorized: false });
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "message" in payload
          ? String((payload as { message: unknown }).message)
          : `Request failed with status ${response.status}`;
      throw new ApiError(response.status, message, payload);
    }

    return payload as T;
  }
}

export const apiClient = new SplitSaathiApiClient();

export function extractInviteToken(tokenOrUrl: string) {
  const trimmed = tokenOrUrl.trim();
  const match = trimmed.match(/\/join\/([^/?#]+)|\/groups\/invites\/([^/?#]+)|^([A-Za-z0-9_-]{12,})$/);
  const token = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!token) {
    throw new Error("Invite token could not be read from the link or QR payload.");
  }
  return token;
}
