import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  backupKey,
  backupSchema,
  latestBackupKey,
  pruneBackups,
  restoreSchema,
  s3Client,
} from "../src/backup.ts";
import { LOCAL_DATABASE_URL } from "../src/env.ts";
import { migrateSchema } from "../src/migrations.ts";
import { supabaseAdmin } from "../src/supabase-admin.ts";
import {
  deleteTestBuckets,
  dropSchemas,
  localKeys,
  localS3,
  testDb,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("backup");
const neighbour = uniqueSchema("neighbour");
const bucket = uniqueSchema("backups").replaceAll("_", "-");
const storage = localS3(bucket);

beforeAll(async () => {
  await migrateSchema(sql, schema, "finance");
  await migrateSchema(sql, neighbour, "finance");
  await sql.unsafe(`insert into ${schema}.settings (org_name) values ('Backup Test Ltd')`);
  const admin = supabaseAdmin({ url: keys.apiUrl, serviceRoleKey: keys.serviceRoleKey });
  const { error } = await admin.storage.createBucket(bucket, { public: false });
  if (error) throw error;
});

afterAll(async () => {
  await dropSchemas(sql, schema, neighbour);
  await deleteTestBuckets(keys, bucket);
  await sql.end();
});

describe("db:backup (SPEC.md 4.5)", () => {
  it("uploads a compressed, dated dump that contains only the requested schema", async () => {
    const result = await backupSchema({
      databaseUrl: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
      schema,
      project: "local",
      storage,
    });
    expect(result.key).toMatch(
      new RegExp(`^local/${schema}/${schema}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}Z\\.dump$`),
    );
    expect(result.bytes).toBeGreaterThan(1000);

    const object = await s3Client(storage).send(
      new GetObjectCommand({ Bucket: bucket, Key: result.key }),
    );
    const bytes = await object.Body?.transformToByteArray();
    expect(bytes?.length).toBe(result.bytes);
    // Custom-format dumps start with the "PGDMP" signature.
    expect(
      Buffer.from(bytes ?? [])
        .subarray(0, 5)
        .toString(),
    ).toBe("PGDMP");

    // List the archive's contents with pg_restore from the matching postgres image.
    const dir = mkdtempSync(join(tmpdir(), "corex-restore-"));
    writeFileSync(join(dir, "backup.dump"), bytes ?? new Uint8Array());
    const list = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "-v",
        `${dir}:/backup:ro`,
        "postgres:17-alpine",
        "pg_restore",
        "--list",
        "/backup/backup.dump",
      ],
      { encoding: "utf8" },
    );
    expect(list.status, list.stderr).toBe(0);
    const tables = list.stdout
      .split("\n")
      .filter((line) => / TABLE /.test(line) && !/ TABLE DATA /.test(line));
    expect(tables.length).toBeGreaterThanOrEqual(10);
    expect(tables.every((line) => line.includes(` ${schema} `))).toBe(true);
    expect(list.stdout).not.toContain(neighbour);
    expect(list.stdout).toContain(`TABLE DATA ${schema} settings`);
  });

  it("refuses a schema that does not exist", async () => {
    await expect(
      backupSchema({
        databaseUrl: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
        schema: uniqueSchema("missing"),
        project: "local",
        storage,
      }),
    ).rejects.toThrow(/does not exist/);
  });

  it("keeps 30 days of backups and removes older ones", async () => {
    const now = new Date("2026-10-24T01:30:00Z");
    const client = s3Client(storage);
    const keysToCreate = [1, 29, 31, 45].map((days) =>
      backupKey("prune", schema, new Date(now.getTime() - days * 24 * 60 * 60 * 1000)),
    );
    for (const key of [...keysToCreate, `prune/${schema}/README.txt`]) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "x" }));
    }
    const removed = await pruneBackups({ storage, project: "prune", schema, keepDays: 30, now });
    expect(removed.sort()).toEqual([keysToCreate[2], keysToCreate[3]].sort());
    const left = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: `prune/${schema}/` }),
    );
    expect((left.Contents ?? []).map((o) => o.Key).sort()).toEqual(
      [keysToCreate[0], keysToCreate[1], `prune/${schema}/README.txt`].sort(),
    );
  });

  it("restores one schema from its newest backup and keeps the replaced data", async () => {
    const url = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
    const target = uniqueSchema("restore");
    await migrateSchema(sql, target, "finance");
    await sql.unsafe(`insert into ${target}.settings (org_name) values ('Before Ltd')`);
    await sql.unsafe(
      `insert into ${target}.categories (name, type) values ('Rent', 'expense'), ('Sales', 'income')`,
    );
    await sql.unsafe(
      `insert into ${neighbour}.categories (name, type) values ('Neighbour', 'income')`,
    );
    try {
      const backup = await backupSchema({
        databaseUrl: url,
        schema: target,
        project: "restore",
        storage,
        now: new Date("2026-10-24T01:30:00Z"),
      });
      // Changes after the backup: a wrong edit and a new record.
      await sql.unsafe(`update ${target}.categories set name = 'Renamed' where name = 'Rent'`);
      await sql.unsafe(`insert into ${target}.categories (name, type) values ('Later', 'income')`);
      await sql.unsafe(`update ${target}.settings set org_name = 'Wrong Ltd'`);

      const result = await restoreSchema({
        databaseUrl: url,
        schema: target,
        project: "restore",
        storage,
      });
      expect(result.key).toBe(backup.key);
      expect(result.safetyKey).not.toBeNull();
      const [org] = await sql.unsafe<{ org_name: string }[]>(
        `select org_name from ${target}.settings`,
      );
      expect(org?.org_name).toBe("Before Ltd");
      const names = await sql.unsafe<{ name: string }[]>(
        `select name from ${target}.categories order by name`,
      );
      expect(names.map((n) => n.name)).toEqual(["Rent", "Sales"]);
      // Migrations, row-level security and the other schema are as they were.
      const [migrations] = await sql.unsafe<{ n: string }[]>(
        `select count(*)::text as n from ${target}._migrations`,
      );
      expect(Number(migrations?.n)).toBeGreaterThan(3);
      const [rls] = await sql.unsafe<{ on: boolean }[]>(
        `select relrowsecurity as on from pg_class where oid = '${target}.categories'::regclass`,
      );
      expect(rls?.on).toBe(true);
      const [kept] = await sql.unsafe<{ n: string }[]>(
        `select count(*)::text as n from ${neighbour}.categories where name = 'Neighbour'`,
      );
      expect(kept?.n).toBe("1");
      // The replaced state was backed up first and is now the newest backup.
      expect(await latestBackupKey({ storage, project: "restore", schema: target })).toBe(
        result.safetyKey,
      );
    } finally {
      await dropSchemas(sql, target);
    }
  });

  it("refuses a backup of another schema", async () => {
    await expect(
      restoreSchema({
        databaseUrl: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
        schema,
        project: "local",
        storage,
        key: `local/${neighbour}/${neighbour}-2026-10-24T01-30-00Z.dump`,
      }),
    ).rejects.toThrow(/is not a backup of/);
  });
});
