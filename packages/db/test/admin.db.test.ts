// Corex Admin database rules (SPEC-ADMIN.md 3.2, 5.2): AUTH-01, AUTH-05, AUTH-06,
// AUTH-07, LOG-01, LOG-02, LOG-05, and the admin migration target.
import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyActivityLog } from "../src/admin/verify-log.ts";
import { migrateSchema, MigrationError } from "../src/migrations.ts";
import {
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("adm");
const tampered = uniqueSchema("adm_t");
const users: string[] = [];

async function newUser(): Promise<string> {
  const id = await createTestUser(keys, testEmail("admin"), "Admin-Test-2026!");
  users.push(id);
  return id;
}

async function addAdmin(userId: string, status = "active"): Promise<string> {
  const [row] = await sql.unsafe<{ id: string }[]>(
    `insert into ${schema}.admins (user_id, username, name, status)
     values ($1, $2, 'Test Admin', $3) returning id`,
    [userId, `u${userId.slice(0, 8)}`, status],
  );
  if (!row) throw new Error("admin not inserted");
  return row.id;
}

async function addSession(userId: string, sessionId: string, lastSeen = "now()"): Promise<void> {
  await sql.unsafe(
    `insert into ${schema}.admin_sessions (user_id, session_id, method, last_seen_at)
     values ($1, $2, 'authenticator', ${lastSeen})`,
    [userId, sessionId],
  );
}

/** Runs `fn` as the API would for a signed-in user with this Supabase session id. */
async function asSession<T>(
  userId: string,
  sessionId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    const claims = { sub: userId, role: "authenticated", session_id: sessionId };
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  }) as Promise<T>;
}

async function asServiceRole<T>(
  fn: (tx: TransactionSql) => Promise<T>,
  headers: Record<string, string> = {},
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "service_role" })}, true)`;
    await tx`select set_config('request.headers', ${JSON.stringify(headers)}, true)`;
    await tx.unsafe("set local role service_role");
    return fn(tx);
  }) as Promise<T>;
}

async function visibleCounts(tx: TransactionSql) {
  const [row] = await tx.unsafe<{ admins: string; settings: string; log: string }[]>(
    `select (select count(*) from ${schema}.admins) as admins,
            (select count(*) from ${schema}.settings) as settings,
            (select count(*) from ${schema}.audit_events) as log`,
  );
  return { admins: Number(row?.admins), settings: Number(row?.settings), log: Number(row?.log) };
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  await migrateSchema(sql, tampered, "admin");
});

afterAll(async () => {
  await dropSchemas(sql, schema, tampered);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("admin migration target", () => {
  it("adds the admin tables to a website-only corex_web schema", async () => {
    const webOnly = uniqueSchema("adm_web");
    try {
      await migrateSchema(sql, webOnly, "web");
      const result = await migrateSchema(sql, webOnly, "admin");
      expect(result.skipped).toEqual(["web/0001_leads"]);
      expect(result.applied).toContain("admin/0002_admins");
      await expect(migrateSchema(sql, webOnly, "web")).rejects.toBeInstanceOf(MigrationError);
    } finally {
      await dropSchemas(sql, webOnly);
    }
  });
});

describe("AUTH-01: a session reads nothing until the second step is verified", () => {
  let userId = "";
  const verified = randomUUID();
  const passwordOnly = randomUUID();

  beforeAll(async () => {
    userId = await newUser();
    await addAdmin(userId);
    await addSession(userId, verified);
  });

  it("a password-only session sees no rows and is told to verify", async () => {
    await asSession(userId, passwordOnly, async (tx) => {
      expect(await visibleCounts(tx)).toEqual({ admins: 0, settings: 0, log: 0 });
      const [state] = await tx.unsafe(`select ${schema}.admin_session_state() as s`);
      expect(state?.s).toBe("unverified");
    });
  });

  it("the verified session of the same admin sees the data", async () => {
    await asSession(userId, verified, async (tx) => {
      const counts = await visibleCounts(tx);
      expect(counts.admins).toBeGreaterThan(0);
      expect(counts.settings).toBe(1);
      const [state] = await tx.unsafe(`select ${schema}.admin_session_state() as s`);
      expect(state?.s).toBe("ok");
    });
  });

  it("anonymous callers have no access at all", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe("set local role anon");
        await tx.unsafe(`select count(*) from ${schema}.admins`);
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("signed-in users cannot record a verified session or read device and link hashes", async () => {
    await expect(
      asSession(userId, verified, (tx) =>
        tx.unsafe(
          `insert into ${schema}.admin_sessions (user_id, session_id, method) values ($1, $2, 'authenticator')`,
          [userId, passwordOnly],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    for (const table of ["trusted_devices", "admin_tokens"]) {
      await expect(
        asSession(userId, verified, (tx) => tx.unsafe(`select count(*) from ${schema}.${table}`)),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe("AUTH-05: sessions end after the inactivity limit", () => {
  it("a session idle past the limit reads nothing and is ended", async () => {
    const userId = await newUser();
    await addAdmin(userId);
    const sessionId = randomUUID();
    await addSession(userId, sessionId, "now() - interval '241 minutes'");
    await asSession(userId, sessionId, async (tx) => {
      expect((await visibleCounts(tx)).settings).toBe(0);
      const [state] = await tx.unsafe(`select ${schema}.admin_session_state() as s`);
      expect(state?.s).toBe("expired");
    });
    const [row] = await sql.unsafe(
      `select revoked_at from ${schema}.admin_sessions where session_id = $1`,
      [sessionId],
    );
    expect(row?.revoked_at).not.toBeNull();
  });

  it("the limit follows Settings", async () => {
    const userId = await newUser();
    await addAdmin(userId);
    const sessionId = randomUUID();
    await addSession(userId, sessionId, "now() - interval '30 minutes'");
    await sql.unsafe(
      `update ${schema}.settings set config = config || '{"session_timeout_minutes": 15}'`,
    );
    try {
      await asSession(userId, sessionId, async (tx) => {
        expect((await visibleCounts(tx)).settings).toBe(0);
      });
    } finally {
      await sql.unsafe(
        `update ${schema}.settings set config = config || '{"session_timeout_minutes": 240}'`,
      );
    }
  });
});

describe("AUTH-07: removing an admin", () => {
  it("the last active admin cannot be removed", async () => {
    const solo = uniqueSchema("adm_solo");
    try {
      await migrateSchema(sql, solo, "admin");
      const userId = await newUser();
      await sql.unsafe(
        `insert into ${solo}.admins (user_id, username, name, status) values ($1, 'solo', 'Solo', 'active')`,
        [userId],
      );
      await expect(
        sql.unsafe(`update ${solo}.admins set status = 'removed' where user_id = $1`, [userId]),
      ).rejects.toThrow(/last admin/);
    } finally {
      await dropSchemas(sql, solo);
    }
  });

  it("signs the admin out everywhere, revokes trusted devices and voids open links", async () => {
    const userId = await newUser();
    const adminId = await addAdmin(userId);
    const sessionId = randomUUID();
    await addSession(userId, sessionId);
    await sql.unsafe(
      `insert into ${schema}.trusted_devices (user_id, token_hash, expires_at)
       values ($1, repeat('a', 64), now() + interval '30 days')`,
      [userId],
    );
    await sql.unsafe(
      `insert into ${schema}.admin_tokens (admin_id, kind, token_hash, expires_at)
       values ($1, 'password_reset', repeat('b', 64), now() + interval '1 hour')`,
      [adminId],
    );

    await sql.unsafe(`update ${schema}.admins set status = 'removed' where id = $1`, [adminId]);

    await asSession(userId, sessionId, async (tx) => {
      expect(await visibleCounts(tx)).toEqual({ admins: 0, settings: 0, log: 0 });
    });
    const [state] = await sql.unsafe<{ sessions: string; devices: string; links: string }[]>(
      `select
         (select count(*) from ${schema}.admin_sessions where user_id = $1 and revoked_at is null) as sessions,
         (select count(*) from ${schema}.trusted_devices where user_id = $1 and revoked_at is null) as devices,
         (select count(*) from ${schema}.admin_tokens where admin_id = $2 and expires_at > now()) as links`,
      [userId, adminId],
    );
    expect(state).toEqual({ sessions: "0", devices: "0", links: "0" });
    await expect(
      sql.unsafe(`update ${schema}.admins set status = 'active' where id = $1`, [adminId]),
    ).rejects.toThrow(/cannot be restored/);
    await expect(
      sql.unsafe(`delete from ${schema}.admins where id = $1`, [adminId]),
    ).rejects.toThrow(/never deleted/);
  });
});

describe("LOG-01: activity log entries cannot be changed or removed", () => {
  const attempts = [
    ["update", `update {s}.audit_events set summary = 'changed'`],
    ["delete", `delete from {s}.audit_events`],
    ["truncate", `truncate {s}.audit_events`],
  ] as const;

  for (const [name, statement] of attempts) {
    it(`service_role cannot ${name}`, async () => {
      await expect(
        asServiceRole((tx) => tx.unsafe(statement.replace("{s}", schema))),
      ).rejects.toThrow(/permission denied|append-only/);
    });

    it(`the database owner cannot ${name} either`, async () => {
      await expect(sql.unsafe(statement.replace("{s}", schema))).rejects.toThrow(/append-only/);
    });
  }

  it("authenticated admins cannot write entries directly", async () => {
    const userId = await newUser();
    await addAdmin(userId);
    const sessionId = randomUUID();
    await addSession(userId, sessionId);
    await expect(
      asSession(userId, sessionId, (tx) =>
        tx.unsafe(
          `insert into ${schema}.audit_events (action, table_name, area, summary) values ('create', 'x', 'system', 'x')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("activity log entries", () => {
  it("names the admin a server action acted for, with address and browser", async () => {
    const actor = randomUUID();
    const [row] = await asServiceRole(
      (tx) =>
        tx.unsafe<{ actor_id: string; actor_type: string; ip: string; user_agent: string }[]>(
          `insert into ${schema}.email_log (to_address, subject, template, status)
           values ('a@example.com', 'Hi', 'test', 'skipped_disabled');
           select ${schema}.log_event('system', 'email_skipped', 'Email skipped') as seq;`,
        ),
      { "x-corex-actor": actor, "x-corex-ip": "41.57.1.2", "x-corex-user-agent": "Test browser" },
    ).then(() =>
      sql.unsafe(
        `select actor_id, actor_type, ip, user_agent from ${schema}.audit_events order by seq desc limit 1`,
      ),
    );
    expect(row).toMatchObject({
      actor_id: actor,
      actor_type: "admin",
      ip: "41.57.1.2",
      user_agent: "Test browser",
    });
  });

  it("LOG-05: hashed tokens never reach the log, and secret details are refused", async () => {
    const userId = await newUser();
    await sql.unsafe(
      `insert into ${schema}.trusted_devices (user_id, token_hash, expires_at)
       values ($1, repeat('c', 64), now() + interval '30 days')`,
      [userId],
    );
    const [entry] = await sql.unsafe<{ after: Record<string, unknown>; area: string }[]>(
      `select after, area from ${schema}.audit_events where table_name = 'trusted_devices' order by seq desc limit 1`,
    );
    expect(entry?.area).toBe("team");
    expect(entry?.after).not.toHaveProperty("token_hash");
    await expect(
      asServiceRole((tx) =>
        tx.unsafe(
          `select ${schema}.log_event('sign_in', 'code_sent', 'Code sent', null, 'system', null, null, '{"code": "123456"}'::jsonb)`,
        ),
      ),
    ).rejects.toThrow(/secrets/);
  });

  it("only the service role can write events", async () => {
    const userId = await newUser();
    await addAdmin(userId);
    const sessionId = randomUUID();
    await addSession(userId, sessionId);
    await expect(
      asSession(userId, sessionId, (tx) =>
        tx.unsafe(`select ${schema}.log_event('system', 'x', 'Spoofed')`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("LOG-02: the hash chain", () => {
  it("stays intact under concurrent writers", async () => {
    const connections = Array.from({ length: 12 }, () => testDb());
    try {
      await Promise.all(
        connections.map((conn, i) =>
          conn.begin(async (tx) => {
            await tx.unsafe(
              `select ${tampered}.log_event('system', 'job_run', 'Concurrent event ${i}')`,
            );
          }),
        ),
      );
    } finally {
      await Promise.all(connections.map((conn) => conn.end()));
    }
    const result = await verifyActivityLog(sql, tampered);
    expect(result.ok).toBe(true);
    const [row] = await sql.unsafe(
      `select count(*)::int as n, max(seq)::int as max from ${tampered}.audit_events`,
    );
    expect(row?.n).toBe(row?.max);
  });

  it("reports the first entry changed behind the triggers' back", async () => {
    await sql.unsafe(
      `alter table ${tampered}.audit_events disable trigger audit_events_append_only`,
    );
    await sql.unsafe(`update ${tampered}.audit_events set summary = 'Tampered' where seq = 3`);
    await sql.unsafe(
      `alter table ${tampered}.audit_events enable trigger audit_events_append_only`,
    );
    const result = await verifyActivityLog(sql, tampered);
    expect(result).toMatchObject({ ok: false, seq: 3 });
    if (!result.ok) expect(result.reason).toMatch(/hash/);
  });
});

describe("sign-in limits (AUTH-04)", () => {
  it("counts failures per key and window without adding one", async () => {
    const key = `signin:test:${randomUUID()}`;
    for (let i = 0; i < 3; i++) {
      await asServiceRole((tx) => tx.unsafe(`select ${schema}.hit_rate_limit($1, 5, 900)`, [key]));
    }
    const [row] = await asServiceRole((tx) =>
      tx.unsafe(`select ${schema}.rate_limit_hits($1, 900) as hits`, [key]),
    );
    expect(row?.hits).toBe(3);
  });
});

// Keep the type import used when the file is type-checked alone.
export type { Sql };
