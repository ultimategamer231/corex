import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectsCommand,
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

  for (let i = 0; i < expired.length; i += 1000) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: options.storage.bucket,
        Delete: { Objects: expired.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
  }
  return expired;
}
