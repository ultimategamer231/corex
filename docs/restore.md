# Restoring a client's data

Every client has its own schema, and the nightly backup keeps 30 days of dumps for each one (`docs/database.md`). A restore replaces **one** schema with one of its backups. Other clients in the same project are not touched.

What a backup holds: everything in the schema (records, settings, members' roles, the audit log, migrations applied). What it does not hold:

- **Sign-ins.** They live in Supabase Auth for the whole project. Restore into the same Supabase project the backup came from, so members can still sign in.
- **Uploaded files** (receipt photos, patient attachments). They are in the schema's Storage bucket, which is not deleted by a restore; file records restored from an older backup still point to their files.

## Before you start

- The backup storage settings (`BACKUP_S3_*`, see `docs/database.md`) and the project's `DATABASE_URL_<PROJECT>` must be set in your shell, as for `db:backup`.
- `pg_restore` of the server's major version, or Docker (the tool then uses the official `postgres` image). The local stack and Supabase both run Postgres 17.
- Tell the client's staff to stop using the system and to sync any offline records first. Records saved on devices after the backup was taken are not in it.

## Restore

```bash
# The newest backup of the schema:
pnpm db:restore --schema client_bethel_school --project clients --confirm client_bethel_school

# A specific backup (keys are listed in the bucket: <project>/<schema>/<schema>-<UTC time>.dump):
pnpm db:restore --schema client_bethel_school --project clients \
  --key clients/client_bethel_school/client_bethel_school-2026-10-24T01-30-00Z.dump \
  --confirm client_bethel_school
```

`--confirm` repeats the schema name so a client's data is never replaced by accident.

The tool:

1. Downloads the backup and checks that it is a dump of this schema.
2. Backs up the schema as it is now. That backup is printed ("saved as ...") and is the newest one, so the restore itself can be undone by restoring it.
3. Drops the schema and restores the backup in one transaction (`pg_restore --single-transaction --exit-on-error`). If anything fails, nothing is restored. Run the command again after fixing the cause; the schema is then restored from the backup you chose.

## After the restore

1. Open the app and sign in as the client's administrator: check the organization name, a few recent records and the reports.
2. If the backup is older than the latest migrations, bring it up to date: `pnpm db:migrate --schema <name> --product <product> --project <label>`.
3. Tell the staff what date the data is from.

## Rehearsal

`packages/db/test/backup.db.test.ts` runs a full round trip on the local stack in CI: back up a schema, change and add records, restore, then check that the data, the migrations and row-level security are back and that the neighbouring schema did not change. Before the first client goes live, rehearse once on the real project with a scratch schema:

```bash
pnpm db:provision --schema restore_drill --product finance --org "Restore drill" \
  --admin-email you@example.com --admin-name "You" --project clients
pnpm db:backup --schema restore_drill --project clients
pnpm db:restore --schema restore_drill --project clients --confirm restore_drill
```

Then drop the drill schema and remove it from `schemas.json`.

Demo schemas are never restored: the nightly reset rebuilds them (`docs/demos.md`).
