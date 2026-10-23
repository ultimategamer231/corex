# Corex Digital Solutions

Monorepo for the Corex MVP: the marketing website and three business systems (School, Clinic, Finance), each testable in a live demo before purchase.

- Build specification: [`docs/SPEC.md`](docs/SPEC.md)
- Website design mockup: [`docs/mockup/`](docs/mockup/) (read-only design reference)
- Build log, decisions and open questions: [`PROGRESS.md`](PROGRESS.md)

## Layout

| Path              | What it is                                                     |
| ----------------- | -------------------------------------------------------------- |
| `apps/web`        | Marketing website                                              |
| `apps/school`     | School Management System (`EDITION=college` or `highschool`)   |
| `apps/clinic`     | Clinic Management System                                       |
| `apps/finance`    | Financial Management System                                    |
| `packages/config` | Shared TypeScript, ESLint, Prettier, Vitest and Next.js config |
| `packages/ui`     | Corex theme tokens, shadcn/ui components, app shell            |
| `supabase/`       | Local Supabase stack config (development only)                 |
| `e2e/`            | Playwright end-to-end and accessibility tests                  |
| `docs/`           | Specification, mockup and operations notes                     |

## Requirements

- Node.js 22 (`.nvmrc`)
- pnpm 10 (`corepack enable`)
- Docker (for the local Supabase stack)

## Common commands

```bash
pnpm install          # install all workspaces
pnpm dev              # run every app in development
pnpm --filter @corex/web dev   # run one app
pnpm lint             # ESLint
pnpm typecheck        # TypeScript
pnpm test             # Vitest unit tests
pnpm build            # production builds
pnpm test:e2e         # Playwright (builds must exist)
pnpm check            # format, lint, typecheck, test, build
```

App ports in development: web 3000, school 3001, clinic 3002, finance 3003.

See each app's and package's `README.md` for details, and [`docs/local-dev.md`](docs/local-dev.md) for the local database.
