# Local development

## Prerequisites

- Node.js 22 and pnpm 10 (`corepack enable`)
- Docker (Docker Desktop on Windows/macOS, Docker Engine on Linux)

```bash
pnpm install
```

## Local Supabase stack

The Supabase CLI (installed as a dev dependency) runs Postgres, Auth, Storage and the REST API in Docker. It is for development only: client schemas are created and migrated by `packages/db` (Phase 2), never by the CLI's own migration system (SPEC.md 4.4).

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm db:local:start`  | Start the stack (first run downloads images, several minutes) |
| `pnpm db:local:status` | Show URLs and the local keys                                  |
| `pnpm db:local:check`  | Check that the API and Auth answer                            |
| `pnpm db:local:stop`   | Stop the stack (data stays in Docker volumes)                 |

Local endpoints:

| Service                   | URL                                                       |
| ------------------------- | --------------------------------------------------------- |
| API (REST, Auth, Storage) | `http://127.0.0.1:54321`                                  |
| Postgres                  | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Email testing (Mailpit)   | `http://127.0.0.1:54324`                                  |

The local anon and service-role keys printed by `pnpm db:local:status` are the same public development keys on every machine. Put them in each app's `.env.local` (copied from `.env.example`). Never use them, or commit real keys, anywhere else.

Settings in `supabase/config.toml`:

- Public sign-up is off (SPEC.md 5.3: admins create users).
- Passwords need at least 8 characters with lower case, upper case and digits.
- Realtime, edge functions, analytics and vector storage are off (not used by the MVP). Studio, imgproxy, postgres-meta and the pooler are skipped by `db:local:start`.
- Redirect URLs allow the four apps on ports 3000 to 3003.

Images are pulled from Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`) because some networks block the CLI's default registry. Set the variable yourself to use another registry.

## Claude Code cloud sessions

`.claude/hooks/session-start.sh` runs at the start of each cloud session: it installs dependencies and starts the Docker daemon, which the container does not start on its own. It does nothing on local machines.

## Apps

| App     | Port | Command                            |
| ------- | ---- | ---------------------------------- |
| Website | 3000 | `pnpm --filter @corex/web dev`     |
| School  | 3001 | `pnpm --filter @corex/school dev`  |
| Clinic  | 3002 | `pnpm --filter @corex/clinic dev`  |
| Finance | 3003 | `pnpm --filter @corex/finance dev` |

## Sample data

`pnpm db:fixture --schema dev_college` rebuilds a small fictional College in the local stack with one sign-in per role (password `Test@2026pass`) and prints the emails. `node scripts/school-env.mjs --schema dev_college` writes the School app's `.env.local` for it. The end-to-end tests use the schema `e2e_college` the same way.

After changing a migration, run `pnpm db:types` to regenerate `packages/db/types/`; CI fails if they differ.
