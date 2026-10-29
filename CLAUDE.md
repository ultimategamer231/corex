# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

- `PROGRESS.md`: current phase and block, owner answers, decisions made on the owner's behalf (D1, D2, ...), open questions. Read it at the start of every session and add a one-line entry per block.
- `docs/SPEC.md`: the build specification and source of truth. Build in the order of its Section 12; never build anything from Section 13 (Not in MVP). Every `[must]` rule (CORE-xx, SCH-xx, CLN-xx, FIN-xx, OFF-xx) needs a passing test.
- `docs/SPEC-ADMIN.md` and `docs/mockup-admin/*.dc.html`: specification and visual reference for `apps/admin`.
- `docs/mockup/*.dc.html`: visual reference for `apps/web` (design-tool files, they do not run). Placeholder text in `[brackets]` belongs in content files, never in components.
- Precedence when sources conflict: owner instructions and the master prompt's amendments, then SPEC.md, then the mockup (visual only). Ask before changing money, grading, payroll, fee or clinical logic, schema beyond SPEC, auth/security approach, or adding risky dependencies.

## Commands

```bash
pnpm install
pnpm check                         # everything CI runs: format, root lint/typecheck, lint, typecheck, test, build
pnpm lint | typecheck | test | build   # turbo across all workspaces
pnpm --filter @corex/ui test       # one workspace
pnpm --filter @corex/ui exec vitest run src/shell/nav-utils.test.ts   # one test file
pnpm --filter @corex/ui exec vitest run -t "collapses the sidebar"    # one test by name
pnpm --filter @corex/school dev    # web 3000, school 3001, clinic 3002, finance 3003, admin 3008
pnpm test:e2e                      # Playwright + axe; needs `pnpm build` first
pnpm test:e2e --project=clinic     # one app
pnpm format                        # Prettier (with Tailwind class sorting)
pnpm db:local:start | stop | status | check   # local Supabase (Docker)
pnpm --filter @corex/db test:db    # database integration tests (needs the local stack)
pnpm db:provision | db:migrate | db:migrate:all | db:backup | db:restore   # see docs/database.md, docs/restore.md
pnpm demo:seed --demo college|highschool   # rebuild a public demo (docs/demos.md)
pnpm admin:invite | admin:reset-authenticator | admin:verify-log   # Corex Admin (apps/admin/README.md)
```

Lint runs with `--max-warnings=0`. App `typecheck` runs `next typegen` first.

## Architecture

pnpm workspaces + Turborepo. Workspace packages ship TypeScript source (no build step); apps compile them via `transpilePackages`.

- `packages/config`: shared tooling. `tsconfig/*` (strict, `noUncheckedIndexedAccess`), `eslint` (Next core-web-vitals + type-aware typescript-eslint + jsx-a11y strict; no `any`, no `console`), `vitest` (`corexVitest({ environment })`, resolves tsconfig paths), `next` (`withCorex(config, csp)` adds CSP/HSTS/nosniff/Referrer-Policy/Permissions-Policy/frame-ancestors and transpiles `@corex/ui`). Plain `.mjs` with JSDoc types.
- `packages/ui`: the Corex design system.
  - `src/styles/theme.css` is the Tailwind v4 theme. It removes Tailwind's default palette (`--color-*: initial`), so only Corex tokens exist (`bg-primary`, `text-ink`, `bg-accent text-accent-foreground`, `text-muted`, `bg-surface`, `border-border-strong`, ...). A new color must be added here, to `extendTailwindMerge` in `src/lib/utils.ts`, and to the contrast pairs in `src/lib/contrast.test.ts`. Note `muted` is the secondary text color and `accent` is the orange CTA (not shadcn's meanings).
  - `src/components/*`: shadcn/ui-pattern components rewritten for Corex tokens; import by path (`@corex/ui/components/button`). `accent` buttons are for the single primary CTA and use dark text (`#1B0A02`).
  - `src/shell/*`: `AppShell` used by every product app (full-width top bar, dark collapsible sidebar on md+, bottom bar with a "More" sheet below md, online/offline badge with pending-sync count, user menu, skip link). Nav items carry icon elements (not components) so Server Components can pass them. Uses `next/link` and `usePathname`, so typed routes are off in the apps.
  - `src/fonts.ts`: Inter and Plus Jakarta Sans through `next/font`; put `fontVariables` on `<html>`.
- `apps/school|clinic|finance`: Next.js App Router. `app/(app)/layout.tsx` wraps pages in `AppShell`; `lib/shell.tsx` holds the nav plus `getOrg()`/`getCurrentUser()` placeholders that Phase 3 replaces with the schema's `settings` row and Supabase Auth memberships (CORE-01). `[section]` pages are static placeholders until each phase builds them. One codebase per product; each client and demo is a separate deployment configured by env vars (`.env.example`), and school picks `EDITION=college|highschool`.
- Offline (SPEC.md 10, `docs/offline.md`): `@corex/core/offline` (Dexie outbox), `/offline/react` (`OfflineProvider`, `useOffline`, `clearOfflineData`), `/offline/transport` and `/offline/server` (`receiveOutboxItem`). Each product app wraps the shell in `components/offline-shell.tsx`, stores synced records in `app/(app)/sync-actions.ts` (access re-checked, inserts ignore duplicates), and marks offline-capable forms with `<ActionForm offline="...">` registered in `lib/offline-forms.ts`; rules shared by online and offline saves live in `lib/schemas.ts`. Serwist: `app/sw.ts` served by `app/serwist/[path]/route.ts`, `app/manifest.ts`, `app/~offline`.
- `apps/admin`: Corex Admin, the internal back office (`docs/SPEC-ADMIN.md`, which wins over SPEC.md for this app; build order in its Section 14, one block at a time with the owner's approval of each block's plan). Data in `corex_web` (migration target `admin`). Sign-in: email or username, password, then an authenticator code (Supabase TOTP) or a trusted device; `admin_sessions` keyed by the JWT `session_id` gates middleware, server actions (`lib/action.ts` `runAction`) and RLS. Service-role writes name the acting admin in the `x-corex-actor` header for the activity log (core `audit_events`, extended with a hash chain in `packages/db/admin/migrations`).
- `apps/web`: marketing site (Phase 4). Contact details live in `content/site.ts`; all copy goes in typed content files under `content/`. Motion and Lenis are allowed here only.
- `e2e/`: Playwright projects per app (`playwright.config.ts` starts each built app). `e2e/helpers.ts` enforces zero serious/critical axe violations (WCAG 2.2 AA tags), no horizontal overflow and 44px touch targets at 360/390/768/1440px.
- `packages/db`: per-client schemas (SPEC.md 4). Scripts are TypeScript run directly by Node 22 (relative imports use `.ts` extensions, erasable syntax only). `core/migrations` apply to every schema, then `<product>/migrations`; files use `{{schema}}` and are immutable once applied (checksummed). `0002_access.sql` defines `has_role`/`is_member`/`is_admin` and the grant model (no anon, RLS-only `authenticated`); products add their own role policies. `0003_audit.sql` provides `enable_audit(table)`, which every product business table must call (CORE-03), and `audit_row_visible()` that products may override. `demo/migrations` is a demo-only layer (`is_seed` guard, locked settings and users, rate-limit counters) applied by `pnpm demo:seed` to the public demo schemas only; demo accounts live in `packages/core/src/demo.ts`. Unit tests are `*.test.ts`; `*.db.test.ts` run against the local stack and act as real `anon`/`authenticated` users (`test/helpers.ts`: `asUser`, `createTestUser`).
- `supabase/`: local development stack only. Client schemas are migrated by `packages/db`, never by the CLI's migration system. Keep `[auth.email] enable_signup = true` (false disables email login); public sign-up is off through `[auth]`.

## Conventions

- Working rule from the owner: build each phase, test, push and merge without waiting for approval; run a full review/audit only after every 5 phases, written to `docs/audits/` (critical/important items only). Stop only for must-ask decisions or audit findings that need the owner. Keep chat updates short.

- Conventional Commits, one commit per block. Never force-push or rewrite pushed history.
- Accessibility, security headers, contrast and touch-target checks are part of every "done"; extend the e2e suite for new pages.
- No em-dash style decoration in UI copy; keep the mockup's copy and section order.

## Cloud sessions

`.claude/hooks/session-start.sh` installs dependencies and starts `dockerd` (it does not run by default in the container). Supabase images come from Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`) because `public.ecr.aws` is rate-limited there. Playwright must stay on 1.63.x to match the preinstalled Chromium.
