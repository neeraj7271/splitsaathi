import {
  ActivityRowDto,
  AuditEntry,
  BalanceRow,
  ExportJob,
  ExpenseRow,
  ExpenseExplanation,
  GroupDetail,
  GroupMode,
  GroupType,
  GroupSummary,
  ImportJob,
  MembershipRole,
  MemberContributionReport,
  MonthlyComparisonReport,
  NetPositionReport,
  RecurringSchedule,
  ReportEnvelope,
  SettlementMethodReport,
  SettlementIntent,
  SettlementSuggestion,
  StartEmailOtpResponse,
  StartOtpResponse,
  UserPreferences,
  UserProfile,
  VerifyOtpResponse
} from "../types/domain";
import { createIdempotencyKey } from "../utils/idempotency";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../auth/tokenStore";
import { logApiConfig, logApiError, logApiRequest, logApiResponse } from "./debugLog";

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
  groupType: GroupType;
  imageAttachmentId?: string;
  baseCurrencyCode: string;
  category?: string;
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
  const proofs = Array.isArray(row.proofs)
    ? row.proofs.map((proof: Record<string, any>) => ({
        id: proof.id ?? proof.proofId,
        attachmentId: proof.attachmentId,
        utr: proof.utr,
        submittedAt: proof.submittedAt
      }))
    : undefined;
  const proofAttachmentId =
    proofs?.find((proof) => proof.attachmentId)?.attachmentId ?? row.attachmentId ?? row.proofAttachmentId;
  return {
    id: row.id ?? row.settlementIntentId,
    groupId: row.groupId,
    payerParticipantId: row.payerParticipantId,
    payeeParticipantId: row.payeeParticipantId,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    paymentMethod: row.paymentMethod,
    state: row.state,
    upiUri: row.upiUri,
    qrPayload: row.qrPayload,
    clientReference: row.clientReference ?? row.providerReference,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    proofs,
    proofAttachmentId,
    proofUrl: proofAttachmentId ? `/v1/attachments/${proofAttachmentId}/content` : undefined
  };
}

function mapActivityRow(row: Record<string, any>): ActivityRowDto {
  return {
    id: row.id ?? row.eventId,
    groupId: row.groupId,
    activityType: row.activityType ?? row.type,
    title: row.title,
    body: row.body,
    actorId: row.actorId,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    entityType: row.entityType ?? row.aggregateType,
    entityId: row.entityId ?? row.aggregateId,
    status: row.status,
    context: row.context,
    occurredAt: row.occurredAt,
    globalPosition: row.globalPosition
  };
}

export type GroupActivityPage = {
  items: ActivityRowDto[];
  nextCursor: number | null;
};

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
    logApiConfig(this.baseUrl);
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

  async startEmailSignup(email: string, password: string, displayName?: string) {
    return this.request<StartEmailOtpResponse>("/v1/auth/email/signup/start", {
      method: "POST",
      body: { email, password, displayName },
      skipAuth: true
    });
  }

  async verifyEmailSignup(challengeId: string, code: string) {
    const response = await this.request<VerifyOtpResponse>("/v1/auth/email/signup/verify", {
      method: "POST",
      body: { challengeId, code },
      skipAuth: true
    });
    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    return response;
  }

  async loginWithEmailPassword(email: string, password: string) {
    const response = await this.request<VerifyOtpResponse>("/v1/auth/email/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true
    });
    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    return response;
  }

  async loginWithGoogle(idToken: string) {
    const response = await this.request<VerifyOtpResponse>("/v1/auth/google", {
      method: "POST",
      body: { idToken },
      skipAuth: true
    });
    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    return response;
  }

  /** Attach phone to the current Google session after OTP (does not create a new user). */
  async linkPhoneVerify(challengeId: string, code: string) {
    return this.request<VerifyOtpResponse>("/v1/auth/phone/link/verify", {
      method: "POST",
      body: { challengeId, code }
    });
  }

  async startPasswordReset(email: string) {
    return this.request<StartEmailOtpResponse>("/v1/auth/password/forgot", {
      method: "POST",
      body: { email },
      skipAuth: true
    });
  }

  async resetPassword(challengeId: string, code: string, password: string) {
    return this.request<void>("/v1/auth/password/reset", {
      method: "POST",
      body: { challengeId, code, password },
      skipAuth: true
    });
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

  async logout() {
    const refreshToken = await getRefreshToken();
    try {
      await this.request<void>("/v1/auth/logout", {
        method: "POST",
        body: refreshToken ? { refreshToken } : {}
      });
    } catch {
      // Local session is still cleared even if the server revoke fails.
    }
    await clearTokens();
  }

  resolveUrl(path?: string | null) {
    if (!path) {
      return null;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async getMe() {
    return this.request<UserProfile>("/v1/users/me");
  }

  async updateMe(input: { displayName?: string; avatarAttachmentId?: string | null; upiVpa?: string | null }) {
    return this.request<UserProfile>("/v1/users/me", {
      method: "PATCH",
      body: input
    });
  }

  async getPreferences() {
    return this.request<UserPreferences>("/v1/users/me/preferences");
  }

  async updatePreferences(input: Partial<UserPreferences>) {
    return this.request<UserPreferences>("/v1/users/me/preferences", {
      method: "PATCH",
      body: input
    });
  }

  async uploadAvatar(file: { uri: string; mimeType: string; name?: string }) {
    const formData = new FormData();
    formData.append("purpose", "avatar");
    formData.append("file", {
      uri: file.uri,
      name: file.name ?? "avatar.jpg",
      type: file.mimeType
    } as unknown as Blob);

    return this.request<{ id: string }>("/v1/attachments", {
      method: "POST",
      formData
    });
  }

  async recordConsent(purpose: "contacts_discovery" | "receipt_upload" | "upi_proof_storage" | "notification_delivery", granted: boolean, source: "onboarding" | "settings" = "onboarding") {
    return this.request<{ id: string }>("/v1/consents", {
      method: "POST",
      body: {
        purpose,
        status: granted ? "granted" : "revoked",
        source
      }
    });
  }

  async listConsents() {
    return this.request<Array<{ id: string; purpose: string; status: "granted" | "revoked"; recordedAt: string }>>("/v1/consents");
  }

  async importContacts(contacts: Array<{ phoneHash: string; displayName?: string }>) {
    return this.request<{ importedCount: number; matchedOnSplitSaathi: number }>("/v1/contacts/import", {
      method: "POST",
      body: { contacts }
    });
  }

  async listContacts() {
    return this.request<
      Array<{
        id: string;
        phoneHash: string;
        displayName?: string | null;
        source: string;
        onSplitSaathi: boolean;
        matchedUserId?: string | null;
        matchedDisplayName?: string | null;
      }>
    >("/v1/contacts");
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

  async updateGroup(
    groupId: string,
    payload: { name?: string; imageAttachmentId?: string | null },
    idempotencyKey = createIdempotencyKey("group.update")
  ) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}`, {
      method: "PATCH",
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

  async unarchiveGroup(groupId: string) {
    return this.request<GroupDetail>(`/v1/groups/${groupId}/unarchive`, {
      method: "POST",
      body: {}
    });
  }

  async leaveGroup(groupId: string) {
    return this.request(`/v1/groups/${groupId}/leave`, {
      method: "POST",
      body: {}
    });
  }

  async removeMember(groupId: string, membershipId: string) {
    return this.request(`/v1/groups/${groupId}/memberships/${membershipId}/remove`, {
      method: "POST",
      body: {}
    });
  }

  async lockMemberExit(groupId: string, membershipId: string) {
    return this.request(`/v1/groups/${groupId}/memberships/${membershipId}/lock-exit`, {
      method: "POST",
      body: {}
    });
  }

  async unlockMemberExit(groupId: string, membershipId: string) {
    return this.request(`/v1/groups/${groupId}/memberships/${membershipId}/unlock-exit`, {
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
      actorId: row.actorId,
      actorName: row.actorName ?? row.actorDisplayName,
      summary: row.eventType ?? row.summary ?? "Update",
      reason: row.reason,
      changes: Array.isArray(row.changes)
        ? row.changes.map((change: Record<string, any>) => ({ field: String(change.field), detail: String(change.detail) }))
        : undefined,
      createdAt: row.occurredAt ?? row.createdAt
    }));
  }

  async explainExpense(expenseId: string) {
    return this.request<ExpenseExplanation>(`/v1/expenses/${expenseId}/explain`);
  }

  async getGroupActivity(
    groupId: string,
    options?: { limit?: number; cursor?: number; q?: string; feed?: "ledger" | "settlement" | "all" }
  ): Promise<GroupActivityPage> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.cursor !== undefined) params.set("cursor", String(options.cursor));
    if (options?.q) params.set("q", options.q);
    if (options?.feed) params.set("feed", options.feed);
    const query = params.toString();
    const response = await this.request<
      | { items: Array<Record<string, any>>; nextCursor: number | null }
      | Array<Record<string, any>>
    >(`/v1/groups/${groupId}/activity${query ? `?${query}` : ""}`);
    if (Array.isArray(response)) {
      return { items: response.map(mapActivityRow), nextCursor: null };
    }
    return {
      items: (response.items ?? []).map(mapActivityRow),
      nextCursor: response.nextCursor ?? null
    };
  }

  /** Backward-compatible unwrap for callers that only need the activity rows. */
  async listGroupActivityItems(
    groupId: string,
    options?: { limit?: number; cursor?: number; q?: string; feed?: "ledger" | "settlement" | "all" }
  ) {
    const page = await this.getGroupActivity(groupId, options);
    return page.items;
  }

  async getBalances(groupId: string) {
    const summary = await this.request<{ balances: Array<Record<string, any>> }>(`/v1/groups/${groupId}/balances`);
    return summary.balances.map((row) => ({
      participantId: row.participantId,
      displayName: row.displayName ?? "",
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
      payerName: row.payerName ?? "",
      payeeParticipantId: row.payeeParticipantId,
      payeeName: row.payeeName ?? "",
      amountMinor: row.amountMinor,
      currencyCode: row.currencyCode,
      explanation: row.explanation
    }));
  }

  async getMonthlyComparisonReport(groupId: string, range: { from: string; to: string }) {
    return this.request<ReportEnvelope<MonthlyComparisonReport>>(`/v1/groups/${groupId}/reports/monthly-comparison?${toQuery(range)}`);
  }

  async getMemberContributionsReport(groupId: string, range: { from: string; to: string }) {
    return this.request<ReportEnvelope<MemberContributionReport>>(`/v1/groups/${groupId}/reports/member-contributions?${toQuery(range)}`);
  }

  async getSettlementMethodsReport(groupId: string, range: { from: string; to: string }) {
    return this.request<ReportEnvelope<SettlementMethodReport>>(`/v1/groups/${groupId}/reports/settlement-methods?${toQuery(range)}`);
  }

  async getNetPositionReport(groupId: string, range: { from: string; to: string }) {
    return this.request<ReportEnvelope<NetPositionReport>>(`/v1/groups/${groupId}/reports/net-position?${toQuery(range)}`);
  }

  async createSettlementIntent(payload: {
    groupId: string;
    payerParticipantId: string;
    payeeParticipantId: string;
    amountMinor: number;
    currencyCode: string;
    suggestionId?: string;
    preferredUpiApp?: string;
    paymentMethod?: "cash" | "upi";
    payeeVpa?: string;
    payeeName?: string;
  }) {
    const response = await this.request<SettlementCommandResponse>("/v1/settlement-intents", {
      method: "POST",
      body: {
        ...payload,
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

  async uploadAttachment(file: { uri: string; name: string; type: string }, purpose: "receipt" | "payment_proof" | "avatar" | "group_image" | "export") {
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
    const startedAt = Date.now();
    const requestPayload = options.formData ?? options.body;
    logApiRequest(method, path, requestPayload);

    const headers: Record<string, string> = {};

    if (!options.formData) {
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    // Dev tunnel interstitials
    if (this.baseUrl.includes("loca.lt") || this.baseUrl.includes("localtunnel.me")) {
      headers["bypass-tunnel-reminder"] = "true";
    }
    if (this.baseUrl.includes("ngrok")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }
    if (!options.skipAuth) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined)
      });
    } catch (error) {
      logApiError(method, path, Date.now() - startedAt, error);
      throw error;
    }

    if (response.status === 401 && options.retryOnUnauthorized !== false && !options.skipAuth) {
      logApiResponse(method, path, response.status, Date.now() - startedAt, { message: "Refreshing access token" });
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
      logApiError(method, path, Date.now() - startedAt, new ApiError(response.status, message, payload));
      throw new ApiError(response.status, message, payload);
    }

    logApiResponse(method, path, response.status, Date.now() - startedAt, payload);
    return payload as T;
  }
}

export const apiClient = new SplitSaathiApiClient();

function toQuery(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

export function extractInviteToken(tokenOrUrl: string) {
  const trimmed = tokenOrUrl.trim();
  const match = trimmed.match(
    /(?:splitsaathi:\/\/join\/|https?:\/\/[^/]+\/join\/|\/join\/)([^/?#]+)|\/groups\/invites\/([^/?#]+)|^([A-Za-z0-9_-]{12,})$/i
  );
  const token = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!token) {
    throw new Error("Invite token could not be read from the link or QR payload.");
  }
  return token;
}
