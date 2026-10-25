import { spawn, spawnSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { connect } from "./db.ts";
import { assertSchemaName } from "./schema-name.ts";

export type BackupStorage = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** S3-compatible backup storage (Cloudflare R2 in production) from BACKUP_S3_* variables. */
export function backupStorageFromEnv(env = process.env): BackupStorage {
  const parsed = z
    .object({
      BACKUP_S3_ENDPOINT: z.url(),
      BACKUP_S3_REGION: z.string().default("auto"),
      BACKUP_S3_BUCKET: z.string().min(1),
      BACKUP_S3_ACCESS_KEY_ID: z.string().min(1),
      BACKUP_S3_SECRET_ACCESS_KEY: z.string().min(1),
    })
    .safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Backup storage is not configured: ${missing}`);
  }
  const e = parsed.data;
  return {
    endpoint: e.BACKUP_S3_ENDPOINT,
    region: e.BACKUP_S3_REGION,
    bucket: e.BACKUP_S3_BUCKET,
    accessKeyId: e.BACKUP_S3_ACCESS_KEY_ID,
    secretAccessKey: e.BACKUP_S3_SECRET_ACCESS_KEY,
  };
}

export function s3Client(storage: BackupStorage): S3Client {
  return new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: true,
    // Cloudflare R2 does not support the SDK's default streaming checksums; send them only when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
  });
}

/** `<project>/<schema>/<schema>-2026-10-24T01-30-00Z.dump`; the timestamp drives retention. */
export function backupKey(project: string, schema: string, at: Date): string {
  const stamp = at
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replaceAll(":", "-");
  return `${project}/${assertSchemaName(schema)}/${schema}-${stamp}.dump`;
}

/** Timestamp encoded in a backup key, or null for keys this tool did not write. */
export function backupKeyDate(key: string): Date | null {
  const match = /-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.dump$/.exec(key);
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

type DumpCommand = { command: string; args: string[]; env: NodeJS.ProcessEnv };

function localPgDumpMajor(binary: string): number | null {
  const result = spawnSync(binary, ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  const match = /(\d+)\.\d+/.exec(result.stdout);
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * pg_dump matching the server's major version: PG_DUMP if set, else a local
 * pg_dump of the same major version, else the official postgres Docker image.
 */
export function dumpCommand(serverMajor: number, url: string, env = process.env): DumpCommand {
  const configured = env.PG_DUMP;
  if (configured) return { command: configured, args: [`--dbname=${url}`], env: {} };
  if (localPgDumpMajor("pg_dump") === serverMajor) {
    return { command: "pg_dump", args: [`--dbname=${url}`], env: {} };
  }
  // The URL travels as an environment variable so the password is not in the process list.
  return {
    command: "docker",
    args: [
      "run",
      "--rm",
      "--network",
      "host",
      "-e",
      "COREX_PG_URL",
      `postgres:${serverMajor}-alpine`,
      "sh",
      "-c",
      'exec pg_dump --dbname="$COREX_PG_URL" "$@"',
      "pg_dump",
    ],
    env: { COREX_PG_URL: url },
  };
}

/** Runs pg_dump and writes its stdout to `file`. */
function runToFile(dump: DumpCommand, args: string[], file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(dump.command, [...dump.args, ...args], {
      env: { ...process.env, ...dump.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = createWriteStream(file);
    // A full or unwritable disk must fail this schema's backup, not crash the whole run.
    out.on("error", (error) => {
      child.kill();
      reject(error);
    });
    child.stdout.pipe(out);
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      out.end(() => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump failed (exit ${code}): ${stderr.trim()}`));
      });
    });
  });
}

export type BackupResult = { key: string; bytes: number };

/**
 * Dumps one schema (pg_dump custom format, compressed) and uploads it to backup
 * storage (SPEC.md 4.5).
 */
export async function backupSchema(options: {
  databaseUrl: string;
  schema: string;
  project: string;
  storage: BackupStorage;
  now?: Date;
}): Promise<BackupResult> {
  const schema = assertSchemaName(options.schema);
  const sql = connect(options.databaseUrl);
  let serverMajor: number;
  try {
    const [row] = await sql<{ major: number }[]>`
      select current_setting('server_version_num')::int / 10000 as major`;
    const exists =
      await sql`select 1 from information_schema.schemata where schema_name = ${schema}`;
    if (exists.length === 0) throw new Error(`Schema "${schema}" does not exist.`);
    serverMajor = row?.major ?? 17;
  } finally {
    await sql.end();
  }

  const dir = mkdtempSync(join(tmpdir(), "corex-backup-"));
  const file = join(dir, "backup.dump");
  try {
    await runToFile(
      dumpCommand(serverMajor, options.databaseUrl),
      ["--format=custom", "--compress=9", `--schema=${schema}`, "--no-owner"],
      file,
    );
    const bytes = statSync(file).size;
    const key = backupKey(options.project, schema, options.now ?? new Date());
    await s3Client(options.storage).send(
      new PutObjectCommand({
        Bucket: options.storage.bucket,
        Key: key,
        Body: createReadStream(file),
        ContentLength: bytes,
        ContentType: "application/octet-stream",
      }),
    );
    return { key, bytes };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Deletes this schema's backups older than `keepDays` (SPEC.md 4.5: keep 30 days). */
export async function pruneBackups(options: {
  storage: BackupStorage;
  project: string;
  schema: string;
  keepDays: number;
  now?: Date;
}): Promise<string[]> {
  const client = s3Client(options.storage);
  const cutoff = (options.now ?? new Date()).getTime() - options.keepDays * 24 * 60 * 60 * 1000;
  const prefix = `${options.project}/${assertSchemaName(options.schema)}/`;
  const expired: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: options.storage.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) {
      const date = object.Key ? backupKeyDate(object.Key) : null;
      if (object.Key && date && date.getTime() < cutoff) expired.push(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  const failed: string[] = [];
  for (let i = 0; i < expired.length; i += 1000) {
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: options.storage.bucket,
        Delete: { Objects: expired.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
    // S3 and R2 report per-object failures with HTTP 200 in Errors.
    for (const error of response.Errors ?? [])
      failed.push(`${error.Key ?? "?"} (${error.Code ?? "error"})`);
  }
  if (failed.length > 0) throw new Error(`Could not delete expired backups: ${failed.join(", ")}`);
  return expired;
}

/** The newest backup of a schema, or null when there is none. */
export async function latestBackupKey(options: {
  storage: BackupStorage;
  project: string;
  schema: string;
}): Promise<string | null> {
  const client = s3Client(options.storage);
  const prefix = `${options.project}/${assertSchemaName(options.schema)}/`;
  let latest: { key: string; at: number } | null = null;
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: options.storage.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) {
      const date = object.Key ? backupKeyDate(object.Key) : null;
      if (object.Key && date && (!latest || date.getTime() > latest.at)) {
        latest = { key: object.Key, at: date.getTime() };
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return latest?.key ?? null;
}

/**
 * pg_restore matching the server's major version: PG_RESTORE if set, else a local
 * pg_restore of the same major version, else the official postgres Docker image with
 * the dump's folder mounted read-only.
 */
export function restoreCommand(
  serverMajor: number,
  url: string,
  file: string,
  env = process.env,
): DumpCommand {
  const configured = env.PG_RESTORE;
  if (configured) return { command: configured, args: [`--dbname=${url}`, file], env: {} };
  if (localPgDumpMajor("pg_restore") === serverMajor) {
    return { command: "pg_restore", args: [`--dbname=${url}`, file], env: {} };
  }
  const dir = file.slice(0, file.lastIndexOf("/"));
  const name = file.slice(file.lastIndexOf("/") + 1);
  return {
    command: "docker",
    args: [
      "run",
      "--rm",
      "--network",
      "host",
      "-v",
      `${dir}:/backup:ro`,
      "-e",
      "COREX_PG_URL",
      `postgres:${serverMajor}-alpine`,
      "sh",
      "-c",
      `exec pg_restore --dbname="$COREX_PG_URL" "$@" /backup/${name}`,
      "pg_restore",
    ],
    env: { COREX_PG_URL: url },
  };
}

function runRestore(restore: DumpCommand, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Options go before the file for a local binary; the Docker form adds the file itself.
    const local = restore.command !== "docker";
    const argv = local
      ? [...args, ...restore.args.slice(0, -1), restore.args.at(-1) ?? ""]
      : [...restore.args, ...args];
    const child = spawn(restore.command, argv, {
      env: { ...process.env, ...restore.env },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_restore failed (exit ${code}): ${stderr.trim()}`));
    });
  });
}

export type RestoreResult = { key: string; safetyKey: string | null };

/**
 * Restores one schema from a backup (SPEC.md 4.5, docs/database.md). When the schema
 * exists it is first backed up again (the "safety" backup) and then replaced; nothing
 * else in the database changes. Sign-ins live in Supabase Auth, not in the schema, so
 * restore into the same Supabase project the backup came from.
 */
export async function restoreSchema(options: {
  databaseUrl: string;
  schema: string;
  project: string;
  storage: BackupStorage;
  /** A backup key, or the newest backup when omitted. */
  key?: string;
  now?: Date;
}): Promise<RestoreResult> {
  const schema = assertSchemaName(options.schema);
  const key = options.key ?? (await latestBackupKey(options));
  if (!key) throw new Error(`No backups of "${schema}" in ${options.project}.`);
  if (!key.startsWith(`${options.project}/${schema}/`)) {
    throw new Error(`Backup ${key} is not a backup of ${options.project}/${schema}.`);
  }

  const sql = connect(options.databaseUrl);
  let serverMajor: number;
  let exists: boolean;
  try {
    const [row] = await sql<{ major: number }[]>`
      select current_setting('server_version_num')::int / 10000 as major`;
    serverMajor = row?.major ?? 17;
    exists =
      (await sql`select 1 from information_schema.schemata where schema_name = ${schema}`).length >
      0;
  } finally {
    await sql.end();
  }

  const dir = mkdtempSync(join(tmpdir(), "corex-restore-"));
  const file = join(dir, "restore.dump");
  try {
    const object = await s3Client(options.storage).send(
      new GetObjectCommand({ Bucket: options.storage.bucket, Key: key }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes || Buffer.from(bytes).subarray(0, 5).toString() !== "PGDMP") {
      throw new Error(`Backup ${key} is not a pg_dump archive.`);
    }
    writeFileSync(file, bytes);

    let safetyKey: string | null = null;
    if (exists) {
      safetyKey = (
        await backupSchema({
          databaseUrl: options.databaseUrl,
          schema,
          project: options.project,
          storage: options.storage,
          now: options.now,
        })
      ).key;
      const drop = connect(options.databaseUrl);
      try {
        await drop.unsafe(`drop schema ${schema} cascade`);
      } finally {
        await drop.end();
      }
    }
    await runRestore(restoreCommand(serverMajor, options.databaseUrl, file), [
      "--no-owner",
      "--exit-on-error",
      "--single-transaction",
    ]);
    // The API caches table definitions; the schema was recreated.
    const notify = connect(options.databaseUrl);
    try {
      await notify.unsafe(`notify pgrst, 'reload schema'`);
    } finally {
      await notify.end();
    }
    return { key, safetyKey };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
