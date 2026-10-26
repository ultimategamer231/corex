# Database: tenancy, provisioning, backups and restore

How client data is separated and how a new client is set up (SPEC.md 4). Code: `packages/db`.

## Model

- Each client gets its **own Postgres schema** (for example `client_bethel_school`) and its **own private storage bucket** with the same name, inside a Supabase project.
- One Supabase project can hold several clients. Large or sensitive clients (clinics, big colleges) can get a dedicated project; the apps do not care which, because every app instance is pointed at a project and schema through environment variables.
- The four demos live in one project reserved for demos (`demo_college`, `demo_highschool`, `demo_clinic`, `demo_finance`). Corex's own website data lives in `corex_web`, in a separate project.

### Project labels

Scripts identify Supabase projects by a short label recorded in `packages/db/schemas.json`:

| Label     | Holds                              | Secrets used by scripts                                                             |
| --------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `demo`    | The four demo schemas              | `DATABASE_URL_DEMO`, `SUPABASE_URL_DEMO`, `SUPABASE_SERVICE_ROLE_KEY_DEMO`          |
| `clients` | Shared project for regular clients | `DATABASE_URL_CLIENTS`, `SUPABASE_URL_CLIENTS`, `SUPABASE_SERVICE_ROLE_KEY_CLIENTS` |
| `web`     | `corex_web` (website leads)        | `DATABASE_URL_WEB`, ...                                                             |
| `<name>`  | A client with a dedicated project  | `DATABASE_URL_<NAME>`, ...                                                          |

These variables are for scripts and CI only. Apps never receive `DATABASE_URL` (SPEC.md 4.2).

## Access rules (SPEC.md 4.3)

1. Each schema has a `memberships` table (`user_id`, `role`, `status`). A user can act in a schema only with an **active** membership row in that schema. One user may hold several roles (one row per role).
2. Row-level security is on for every table. Policies call the schema's own helpers: `has_role(text[])`, `is_member()`, `is_admin()` (Super Admin, Admin or Owner).
3. A user of client A who calls client B's schema through the API gets **no rows and cannot write**. This is tested through the real API in `packages/db/test/isolation.db.test.ts`.
4. `anon` has no privileges on any client schema.
5. Server code re-checks permissions before every write (from Phase 3), in addition to RLS.
6. The service-role key is used only by scripts and server-only provisioning code.
7. **Known limitation: one email address can belong to only one client in the same Supabase project.** Supabase Auth is shared by every schema in a project, so a person who works for two clients needs two email addresses, or the clients must be in different projects. `db:provision` refuses an admin email that is already a member of another schema.

Every change to a business record writes an `audit_events` row with the acting user (CORE-03). The audit log is append-only, even for the database owner.

## Provisioning a new client

```bash
pnpm db:provision --schema client_bethel_school --product school \
  --org "Bethel High School" --admin-email principal@bethel.example \
  --admin-name "Principal Name" --project clients \
  --redirect-to https://bethel.example.com/auth/callback
```

This creates the schema, applies core and product migrations, writes the settings row, creates the private bucket, invites the first administrator by email (Super Admin for school, Admin for clinic, Owner for finance), and adds the schema to `schemas.json`. It is safe to run again.

Then:

1. **Expose the schema to the API:** Supabase dashboard > Project Settings > Data API > Exposed schemas: add the schema name and save. Without this the app cannot reach it. (The local stack is exposed automatically.)
2. Commit the `schemas.json` change.
3. Deploy the app instance with `NEXT_PUBLIC_DB_SCHEMA` and `NEXT_PUBLIC_STORAGE_BUCKET` set to the schema name.

The project must have email (SMTP) configured so the invitation reaches the administrator.

## Migrations

```bash
pnpm db:migrate --schema <name> --product <school|clinic|finance> [--project <label>]
pnpm db:migrate:all --product <school|clinic|finance> [--project <label>]
```

`db:migrate:all` migrates every registered schema of a product and stops at the first failure. Never edit an applied migration; add a new file (see `packages/db/README.md`).

Demo schemas are migrated by `pnpm demo:seed`, which also applies the demo-only layer in `packages/db/demo/migrations` (see `docs/demos.md`). Never apply that layer to a client schema.

## Backups (SPEC.md 4.5)

`pnpm db:backup --schema <name> --project <label>` dumps one schema (`pg_dump` custom format, compressed) to S3-compatible storage at `<project>/<schema>/<schema>-<UTC timestamp>.dump`, then deletes that schema's backups older than 30 days. `--all true` does this for every registered schema.

The nightly workflow `.github/workflows/backup.yml` runs at 01:30 Monrovia time. It is **off** until configured:

1. Create a Cloudflare R2 bucket (for example `corex-backups`) and an R2 API token with read and write access to that bucket only.
2. Add a lifecycle rule on the bucket that deletes objects after 31 days, as a safety net for the script's own pruning.
3. In GitHub: Settings > Secrets and variables > Actions, add the secrets `BACKUP_S3_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`), `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, and one `DATABASE_URL_<PROJECT>` per project label. Use each project's direct or session-pooler connection string.
4. Add the repository variable `BACKUPS_ENABLED` = `true`, then run the workflow once by hand (Actions > Nightly backup > Run workflow) and check the bucket.

Restoring a schema from a backup: see `docs/restore.md` (tested by `packages/db/test/backup.db.test.ts`).

## Website leads (`corex_web`)

The website project holds one schema, `corex_web`, with `leads`, `rate_limits` and `hit_rate_limit()`. It is not a client schema: no memberships, no core tables, and only `service_role` has access.

1. Add the GitHub secret `DATABASE_URL_WEB` (the project's Session pooler connection string), then run Actions > **Website database** > Run workflow. Locally: `pnpm db:migrate --schema corex_web --product web --project web`.
2. Supabase dashboard of the website project: add `corex_web` to API, Exposed schemas.
3. Website environment (Vercel, server only): `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` of that project. Without them production refuses quote requests instead of losing them.
