# @corex/db

Per-client Postgres schemas for the Corex apps (SPEC.md 4): migration runner, provisioning, backups, core tables, access helpers and audit triggers. Scripts run directly on Node 22 (TypeScript type stripping), so there is no build step.

## Migrations

- `core/migrations/NNNN_name.sql` apply to every client schema; `<product>/migrations/` apply after them for that product (`school`, `clinic`, `finance`).
- Write `{{schema}}` wherever the schema name goes. Any other `{{...}}` placeholder is an error.
- Never edit a migration once it has been applied anywhere: the runner stores a SHA-256 checksum per migration in `<schema>._migrations` and refuses changed files. Add a new numbered file instead.
- All pending migrations for a schema run in one transaction, under an advisory lock.
- A schema belongs to one product; migrating it as another product is refused.

```bash
pnpm db:migrate --schema client_bethel_school --product school [--project main]
pnpm db:migrate:all --product school [--project demo]   # every registered school schema, stops at first failure
```

## Registry and database URLs

`schemas.json` lists every provisioned schema with its product and Supabase project label. A project's database URL comes from `DATABASE_URL_<PROJECT>` (for example `DATABASE_URL_DEMO`), then `DATABASE_URL`, then the local stack. These variables are for scripts only, never for an app.

## Tests

```bash
pnpm --filter @corex/db test       # unit tests
pnpm db:local:start
pnpm --filter @corex/db test:db    # integration tests against the local Supabase stack
```
