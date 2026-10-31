import { beforeEach, describe, expect, it, vi } from "vitest";

// The backup endpoints' doors (spec 20): which token opens which route. The
// database and the snapshot are replaced by stand-ins; only the checks run.

const EXPORT_TOKEN = "e".repeat(64);
const WEBHOOK_TOKEN = "w".repeat(64);

const inserted = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({ BACKUP_EXPORT_TOKEN: EXPORT_TOKEN, BACKUP_WEBHOOK_TOKEN: WEBHOOK_TOKEN }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.rows.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "run-1" }, error: null }) }) };
      },
    }),
  }),
}));
vi.mock("@/lib/backup/export", () => ({
  adminSnapshotStream: () => new Response('{"ok":true}').body,
  gzip: (stream: ReadableStream<Uint8Array>) => stream,
}));
vi.mock("@/lib/backup/day-report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/backup/day-report")>()),
  loadBackupDayReport: async () => ({}),
  dayReportFile: () => ({ fileName: "day-report-2026-10-30.csv", contentType: "text/csv; charset=utf-8", body: "a,b" }),
}));

const { GET: exportGet } = await import("./export/route");
const { GET: dayReportGet } = await import("./day-report/route");
const { POST: heartbeatPost } = await import("./heartbeat/route");

function request(url: string, init: { token?: string; cookie?: string; body?: unknown; method?: string } = {}) {
  const headers = new Headers();
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const posSession = "sb-xpcsmqwdpswnvzyterwx-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0";

beforeEach(() => {
  inserted.rows = [];
});

describe("GET /api/backup/export", () => {
  it.each([
    ["no token", {}],
    ["the GitHub token", { token: WEBHOOK_TOKEN }],
    ["a POS session", { cookie: posSession }],
    ["a wrong token", { token: "x".repeat(64) }],
  ])("refuses %s with a bare 401", async (_label, init) => {
    const response = await exportGet(request("/api/backup/export", init));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("sends the compressed snapshot for the studio PC's token", async () => {
    const response = await exportGet(request("/api/backup/export", { token: EXPORT_TOKEN }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    expect(response.headers.get("content-disposition")).toMatch(/bestman-backup-\d{4}-\d{2}-\d{2}\.json\.gz/);
  });
});

describe("GET /api/backup/day-report", () => {
  it.each([
    ["no token", {}],
    ["the GitHub token", { token: WEBHOOK_TOKEN }],
    ["a POS session", { cookie: posSession }],
  ])("refuses %s", async (_label, init) => {
    expect((await dayReportGet(request("/api/backup/day-report?date=2026-10-30&format=csv", init))).status).toBe(401);
  });

  it("checks the date and format, then sends the file", async () => {
    expect((await dayReportGet(request("/api/backup/day-report?date=2026-02-31&format=csv", { token: EXPORT_TOKEN }))).status).toBe(400);
    expect((await dayReportGet(request("/api/backup/day-report?date=2026-10-30&format=pdf", { token: EXPORT_TOKEN }))).status).toBe(400);
    const response = await dayReportGet(request("/api/backup/day-report?date=2026-10-30&format=csv", { token: EXPORT_TOKEN }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("day-report-2026-10-30.csv");
  });
});

describe("POST /api/backup/heartbeat", () => {
  const daily = { kind: "daily_pc", status: "success", file_name: "bestman-backup-2026-10-30.json", size_bytes: 1200, row_counts: { sales: 300 } };
  const weekly = { kind: "weekly_cloud", status: "success", storage_path: "weekly/bestman-2026-11-01.dump" };

  it("refuses no token, a POS session, and a wrong token", async () => {
    for (const init of [{}, { cookie: posSession }, { token: "x".repeat(64) }]) {
      expect((await heartbeatPost(request("/api/backup/heartbeat", { ...init, method: "POST", body: daily }))).status).toBe(401);
    }
    expect(inserted.rows).toHaveLength(0);
  });

  it("refuses a weekly_cloud report with the PC token and a daily_pc report with the GitHub token", async () => {
    expect((await heartbeatPost(request("/api/backup/heartbeat", { token: EXPORT_TOKEN, method: "POST", body: weekly }))).status).toBe(403);
    expect((await heartbeatPost(request("/api/backup/heartbeat", { token: WEBHOOK_TOKEN, method: "POST", body: daily }))).status).toBe(403);
    expect(inserted.rows).toHaveLength(0);
  });

  it("saves a run for the right token, and refuses an invalid body", async () => {
    const response = await heartbeatPost(request("/api/backup/heartbeat", { token: EXPORT_TOKEN, method: "POST", body: daily }));
    expect(response.status).toBe(201);
    expect(inserted.rows[0]).toMatchObject({ kind: "daily_pc", status: "success", size_bytes: 1200, row_counts: { sales: 300 } });
    expect((await heartbeatPost(request("/api/backup/heartbeat", { token: WEBHOOK_TOKEN, method: "POST", body: weekly }))).status).toBe(201);
    expect(
      (await heartbeatPost(request("/api/backup/heartbeat", { token: EXPORT_TOKEN, method: "POST", body: { ...daily, kind: "manual_download" } })))
        .status,
    ).toBe(400);
    expect(
      (await heartbeatPost(request("/api/backup/heartbeat", { token: EXPORT_TOKEN, method: "POST", body: { ...daily, extra: 1 } }))).status,
    ).toBe(400);
  });
});
