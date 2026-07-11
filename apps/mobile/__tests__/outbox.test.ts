const mockOpenDatabaseAsync = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: mockOpenDatabaseAsync
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined)
}));

type FakeOutboxRow = {
  id: string;
  client_mutation_id: string;
  idempotency_key: string;
  command_type: string;
  payload_json: string;
  expected_aggregate_version?: number | null;
  created_at: string;
  status: "queued" | "syncing" | "failed";
  last_error?: string | null;
};

function createFakeDb() {
  const rows: FakeOutboxRow[] = [];
  return {
    rows,
    db: {
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes("insert into local_command_outbox")) {
          rows.push({
            id: String(params[0]),
            client_mutation_id: String(params[1]),
            idempotency_key: String(params[2]),
            command_type: String(params[3]),
            payload_json: String(params[4]),
            expected_aggregate_version: params[5] as number | null,
            created_at: String(params[6]),
            status: params[7] as "queued" | "syncing" | "failed",
            last_error: null
          });
          return;
        }

        if (sql.includes("delete from local_command_outbox where client_mutation_id")) {
          const index = rows.findIndex((row) => row.client_mutation_id === params[0]);
          if (index >= 0) {
            rows.splice(index, 1);
          }
          return;
        }

        if (sql.includes("set status = ?, last_error = ? where client_mutation_id")) {
          const row = rows.find((candidate) => candidate.client_mutation_id === params[2]);
          if (row) {
            row.status = params[0] as "queued" | "syncing" | "failed";
            row.last_error = String(params[1]);
          }
          return;
        }

        if (sql.includes("set status = ?, last_error = ? where id = ?")) {
          const row = rows.find((candidate) => candidate.id === params[2]);
          if (row) {
            row.status = params[0] as "queued" | "syncing" | "failed";
            row.last_error = String(params[1]);
          }
          return;
        }

        if (sql.includes("set status = ? where id = ?")) {
          const row = rows.find((candidate) => candidate.id === params[1]);
          if (row) {
            row.status = params[0] as "queued" | "syncing" | "failed";
          }
        }
      }),
      getAllAsync: jest.fn(async () => [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    }
  };
}

describe("mobile offline outbox", () => {
  let fake: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    jest.resetModules();
    fake = createFakeDb();
    mockOpenDatabaseAsync.mockResolvedValue(fake.db);
  });

  it("enqueues commands and exposes queue status", async () => {
    const { enqueueCommand, getOutboxStatus, listOutbox } = await import("../src/offline/outbox");

    const record = await enqueueCommand("expense.create", { description: "Offline dinner" }, 3);
    const rows = await listOutbox();
    const status = await getOutboxStatus();

    expect(record.commandType).toBe("expense.create");
    expect(record.expectedAggregateVersion).toBe(3);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientMutationId: record.clientMutationId,
      idempotencyKey: record.idempotencyKey,
      status: "queued"
    });
    expect(JSON.parse(rows[0].payloadJson)).toEqual({ description: "Offline dinner" });
    expect(status).toMatchObject({ queued: 1, syncing: 0, failed: 0, total: 1 });
  });

  it("deletes accepted commands and keeps rejected commands with an error", async () => {
    const { enqueueCommand, flushOutbox, listOutbox } = await import("../src/offline/outbox");
    const accepted = await enqueueCommand("expense.create", { description: "Accepted" });
    const rejected = await enqueueCommand("settlement.proof", { utr: "BAD" });

    const result = await flushOutbox({
      postCommandBatch: jest.fn(async () => ({
        results: [
          {
            clientMutationId: accepted.clientMutationId,
            commandType: "expense.create",
            status: "accepted",
            eventIds: ["event-1"],
            globalPositions: [1]
          },
          {
            clientMutationId: rejected.clientMutationId,
            commandType: "settlement.proof",
            status: "conflict",
            eventIds: [],
            globalPositions: [],
            error: "Duplicate reference"
          }
        ],
        events: [],
        nextCursor: 1
      }))
    } as any);

    expect(result.results.map((row) => row.clientMutationId)).toEqual([accepted.clientMutationId, rejected.clientMutationId]);
    const rows = await listOutbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientMutationId: rejected.clientMutationId,
      status: "failed",
      lastError: "Duplicate reference"
    });
  });

  it("marks queued commands failed when sync throws", async () => {
    const { enqueueCommand, flushOutbox, listOutbox } = await import("../src/offline/outbox");
    const queued = await enqueueCommand("expense.create", { description: "Network issue" });

    await expect(
      flushOutbox({
        postCommandBatch: jest.fn(async () => {
          throw new Error("Network unavailable");
        })
      } as any)
    ).rejects.toThrow("Network unavailable");

    await expect(listOutbox()).resolves.toMatchObject([
      {
        clientMutationId: queued.clientMutationId,
        status: "failed",
        lastError: "Network unavailable"
      }
    ]);
  });
});
