import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { apiClient, BatchCommand, SplitSaathiApiClient } from "../api/client";
import { createClientId, createIdempotencyKey } from "../utils/idempotency";

type Db = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
};

export interface OutboxCommandRecord {
  id: string;
  clientMutationId: string;
  idempotencyKey: string;
  commandType: string;
  payloadJson: string;
  expectedAggregateVersion?: number;
  createdAt: string;
  status: "queued" | "syncing" | "failed";
  lastError?: string;
}

let dbPromise: Promise<Db> | null = null;
const WEB_OUTBOX_KEY = "splitsaathi.localCommandOutbox";

async function getDb() {
  if (!dbPromise) {
    dbPromise = (SQLite as unknown as { openDatabaseAsync: (name: string) => Promise<Db> }).openDatabaseAsync("splitsaathi.db");
  }

  return dbPromise;
}

export async function initOutbox() {
  if (Platform.OS === "web") {
    webReadOutbox();
    return;
  }

  const db = await getDb();
  await db.execAsync(`
    create table if not exists local_command_outbox (
      id text primary key not null,
      client_mutation_id text not null,
      idempotency_key text not null,
      command_type text not null,
      payload_json text not null,
      expected_aggregate_version integer null,
      created_at text not null,
      status text not null,
      last_error text null
    );

    create table if not exists local_sync_cursor (
      id text primary key not null,
      cursor text null,
      updated_at text not null
    );
  `);
}

export async function enqueueCommand(commandType: string, payload: Record<string, unknown>, expectedAggregateVersion?: number) {
  if (Platform.OS === "web") {
    const record = createOutboxRecord(commandType, payload, expectedAggregateVersion);
    const rows = webReadOutbox();
    rows.push(record);
    webWriteOutbox(rows);
    return record;
  }

  await initOutbox();
  const db = await getDb();
  const record = createOutboxRecord(commandType, payload, expectedAggregateVersion);

  await db.runAsync(
    `insert into local_command_outbox (
      id, client_mutation_id, idempotency_key, command_type, payload_json,
      expected_aggregate_version, created_at, status, last_error
    ) values (?, ?, ?, ?, ?, ?, ?, ?, null)`,
    [
      record.id,
      record.clientMutationId,
      record.idempotencyKey,
      record.commandType,
      record.payloadJson,
      record.expectedAggregateVersion ?? null,
      record.createdAt,
      record.status
    ]
  );

  return record;
}

export async function listOutbox() {
  if (Platform.OS === "web") {
    return webReadOutbox().sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  await initOutbox();
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    client_mutation_id: string;
    idempotency_key: string;
    command_type: string;
    payload_json: string;
    expected_aggregate_version?: number;
    created_at: string;
    status: "queued" | "syncing" | "failed";
    last_error?: string;
  }>("select * from local_command_outbox order by created_at asc");

  return rows.map<OutboxCommandRecord>((row) => ({
    id: row.id,
    clientMutationId: row.client_mutation_id,
    idempotencyKey: row.idempotency_key,
    commandType: row.command_type,
    payloadJson: row.payload_json,
    expectedAggregateVersion: row.expected_aggregate_version,
    createdAt: row.created_at,
    status: row.status,
    lastError: row.last_error
  }));
}

export async function getOutboxStatus() {
  const rows = await listOutbox();

  return {
    queued: rows.filter((row) => row.status === "queued").length,
    syncing: rows.filter((row) => row.status === "syncing").length,
    failed: rows.filter((row) => row.status === "failed").length,
    total: rows.length,
    rows
  };
}

export function describeOutboxCommand(row: OutboxCommandRecord): {
  title: string;
  summary: string;
  amountLabel?: string;
  meta: string;
} {
  const commandLabel =
    row.commandType === "expense.create"
      ? "Create expense"
      : row.commandType === "expense.revise" || row.commandType === "expense.revision"
        ? "Edit expense"
        : row.commandType === "expense.void"
          ? "Delete expense"
          : row.commandType === "settlement.proof" || row.commandType.includes("proof")
            ? "Upload proof"
            : row.commandType.replace(/\./g, " ");

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const currencyCode = typeof payload.currencyCode === "string" ? payload.currencyCode : "INR";
  const description =
    typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim()
      : commandLabel;
  const expenseDate = typeof payload.expenseDate === "string" ? payload.expenseDate : undefined;
  const notes = typeof payload.notes === "string" && payload.notes.trim() ? payload.notes.trim() : undefined;
  const category = typeof payload.category === "string" && payload.category.trim() ? payload.category.trim() : undefined;
  const reason = typeof payload.reason === "string" && payload.reason.trim() ? payload.reason.trim() : undefined;

  const payers = Array.isArray(payload.payers) ? payload.payers : [];
  const shares = Array.isArray(payload.shares) ? payload.shares : [];
  const totalFromPayers = payers.reduce((sum, payer) => {
    if (!payer || typeof payer !== "object") {
      return sum;
    }
    const amount = (payer as { amountMinor?: unknown }).amountMinor;
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);
  const totalFromShares = shares.reduce((sum, share) => {
    if (!share || typeof share !== "object") {
      return sum;
    }
    const amount = (share as { amountMinor?: unknown }).amountMinor;
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);
  const totalMinor =
    typeof payload.totalAmountMinor === "number"
      ? payload.totalAmountMinor
      : totalFromPayers || totalFromShares || undefined;

  const splitTypes = [
    ...new Set(
      shares
        .map((share) =>
          share && typeof share === "object" ? String((share as { shareType?: unknown }).shareType ?? "") : ""
        )
        .filter(Boolean)
    )
  ];
  const splitLabel = splitTypes.length === 1 ? `${splitTypes[0]} split` : splitTypes.length ? "mixed split" : undefined;

  const parts = [
    commandLabel,
    expenseDate,
    splitLabel,
    category ? `category ${category}` : undefined,
    payers.length ? `${payers.length} payer${payers.length === 1 ? "" : "s"}` : undefined,
    shares.length ? `${shares.length} share${shares.length === 1 ? "" : "s"}` : undefined,
    notes ? `note: ${notes}` : undefined,
    reason ? `reason: ${reason}` : undefined
  ].filter(Boolean);

  return {
    title: description,
    summary: parts.join(" · "),
    amountLabel: typeof totalMinor === "number" ? formatMoney(totalMinor, currencyCode) : undefined,
    meta: new Date(row.createdAt).toLocaleString()
  };
}

function formatMoney(amountMinor: number, currencyCode: string) {
  const major = (Math.abs(amountMinor) / 100).toFixed(2);
  const signed = amountMinor < 0 ? "-" : "";
  return currencyCode === "INR" ? `${signed}₹${major}` : `${signed}${major} ${currencyCode}`;
}

export async function flushOutbox(client: SplitSaathiApiClient = apiClient) {
  if (Platform.OS === "web") {
    const rows = await listOutbox();
    const pending = rows.filter((row) => row.status === "queued" || row.status === "failed");

    if (pending.length === 0) {
      return { results: [], events: [], nextCursor: 0 };
    }

    webWriteOutbox(rows.map((row) => (pending.some((pendingRow) => pendingRow.id === row.id) ? { ...row, status: "syncing" } : row)));

    const commands: BatchCommand[] = pending.map((row) => ({
      clientMutationId: row.clientMutationId,
      idempotencyKey: row.idempotencyKey,
      commandType: row.commandType,
      payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
      expectedAggregateVersion: row.expectedAggregateVersion
    }));

    try {
      const result = await client.postCommandBatch(commands);
      const acceptedIds = new Set(result.results.filter((row) => row.status === "accepted").map((row) => row.clientMutationId));
      const rejected = new Map(result.results.filter((row) => row.status !== "accepted").map((row) => [row.clientMutationId, row]));
      webWriteOutbox(
        webReadOutbox()
          .filter((row) => !acceptedIds.has(row.clientMutationId))
          .map((row) => {
            const rejection = rejected.get(row.clientMutationId);
            return rejection ? { ...row, status: "failed", lastError: rejection.error ?? rejection.status } : row;
          })
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      webWriteOutbox(webReadOutbox().map((row) => (pending.some((pendingRow) => pendingRow.id === row.id) ? { ...row, status: "failed", lastError: message } : row)));
      throw error;
    }
  }

  await initOutbox();
  const db = await getDb();
  const rows = await listOutbox();
  const pending = rows.filter((row) => row.status === "queued" || row.status === "failed");

  if (pending.length === 0) {
    return { results: [], events: [], nextCursor: 0 };
  }

  await Promise.all(pending.map((row) => db.runAsync("update local_command_outbox set status = ? where id = ?", ["syncing", row.id])));

  const commands: BatchCommand[] = pending.map((row) => ({
    clientMutationId: row.clientMutationId,
    idempotencyKey: row.idempotencyKey,
    commandType: row.commandType,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    expectedAggregateVersion: row.expectedAggregateVersion
  }));

  try {
    const result = await client.postCommandBatch(commands);
    const accepted = result.results.filter((row) => row.status === "accepted");
    const rejected = result.results.filter((row) => row.status !== "accepted");

    await Promise.all(accepted.map((row) => db.runAsync("delete from local_command_outbox where client_mutation_id = ?", [row.clientMutationId])));
    await Promise.all(
      rejected.map((rejection) =>
        db.runAsync("update local_command_outbox set status = ?, last_error = ? where client_mutation_id = ?", [
          "failed",
          rejection.error ?? rejection.status,
          rejection.clientMutationId
        ])
      )
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await Promise.all(pending.map((row) => db.runAsync("update local_command_outbox set status = ?, last_error = ? where id = ?", ["failed", message, row.id])));
    throw error;
  }
}

function createOutboxRecord(commandType: string, payload: Record<string, unknown>, expectedAggregateVersion?: number): OutboxCommandRecord {
  return {
    id: createClientId("outbox"),
    clientMutationId: createClientId(commandType),
    idempotencyKey: createIdempotencyKey(commandType),
    commandType,
    payloadJson: JSON.stringify(payload),
    expectedAggregateVersion,
    createdAt: new Date().toISOString(),
    status: "queued"
  };
}

function webReadOutbox(): OutboxCommandRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_OUTBOX_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as OutboxCommandRecord[];
  } catch {
    window.localStorage.removeItem(WEB_OUTBOX_KEY);
    return [];
  }
}

function webWriteOutbox(rows: OutboxCommandRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WEB_OUTBOX_KEY, JSON.stringify(rows));
  }
}
