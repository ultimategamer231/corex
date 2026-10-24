import { describe, expect, it, vi } from "vitest";
import { backupKey, backupKeyDate, backupStorageFromEnv, dumpCommand } from "./backup.ts";

describe("backup keys", () => {
  const at = new Date("2026-10-24T01:30:05.123Z");

  it("group backups by project and schema with a sortable timestamp", () => {
    expect(backupKey("demo", "demo_college", at)).toBe(
      "demo/demo_college/demo_college-2026-10-24T01-30-05Z.dump",
    );
  });

  it("read the timestamp back for retention", () => {
    expect(backupKeyDate(backupKey("demo", "demo_college", at))?.toISOString()).toBe(
      "2026-10-24T01:30:05.000Z",
    );
    expect(backupKeyDate("demo/demo_college/notes.txt")).toBeNull();
  });

  it("refuse unsafe schema names", () => {
    expect(() => backupKey("demo", "../etc", at)).toThrow();
  });
});

describe("dumpCommand", () => {
  it("uses PG_DUMP when set", () => {
    const cmd = dumpCommand(17, "postgresql://x", {
      PG_DUMP: "/usr/lib/postgresql/17/bin/pg_dump",
    });
    expect(cmd.command).toBe("/usr/lib/postgresql/17/bin/pg_dump");
  });

  it("falls back to the matching postgres image without putting the URL in arguments", () => {
    const cmd = dumpCommand(99, "postgresql://user:secret@db/postgres", {});
    expect(cmd.command).toBe("docker");
    expect(cmd.args).toContain("postgres:99-alpine");
    expect(cmd.args.join(" ")).not.toContain("secret");
    expect(cmd.env.COREX_PG_URL).toBe("postgresql://user:secret@db/postgres");
  });
});

describe("backupStorageFromEnv", () => {
  it("lists missing variables", () => {
    expect(() => backupStorageFromEnv({})).toThrow(/BACKUP_S3_ENDPOINT.*BACKUP_S3_BUCKET/);
  });

  it("defaults the region to auto (Cloudflare R2)", () => {
    const storage = backupStorageFromEnv({
      BACKUP_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      BACKUP_S3_BUCKET: "corex-backups",
      BACKUP_S3_ACCESS_KEY_ID: "id",
      BACKUP_S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(storage.region).toBe("auto");
  });
});

describe("pruneBackups", () => {
  it("fails loudly when storage reports objects it could not delete", async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const { pruneBackups, backupKey } = await import("./backup.ts");
    const now = new Date("2026-10-24T01:30:00Z");
    const old = backupKey("demo", "demo_college", new Date("2026-08-01T01:30:00Z"));
    vi.spyOn(S3Client.prototype, "send").mockImplementation(((command: {
      constructor: { name: string };
    }) =>
      Promise.resolve(
        command.constructor.name === "ListObjectsV2Command"
          ? { Contents: [{ Key: old }], IsTruncated: false }
          : { Errors: [{ Key: old, Code: "AccessDenied" }] },
      )) as never);
    await expect(
      pruneBackups({
        storage: {
          endpoint: "https://r2.example",
          region: "auto",
          bucket: "b",
          accessKeyId: "a",
          secretAccessKey: "s",
        },
        project: "demo",
        schema: "demo_college",
        keepDays: 30,
        now,
      }),
    ).rejects.toThrow(/AccessDenied/);
  });
});
