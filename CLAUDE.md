# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read first

- `PROGRESS.md`: current phase and block, owner answers, decisions made on the owner's behalf (D1, D2, ...), open questions. Read it at the start of every session and add a one-line entry per block.
- `docs/SPEC.md`: the build specification and source of truth. Build in the order of its Section 12; never build anything from Section 13 (Not in MVP). Every `[must]` rule (CORE-xx, SCH-xx, CLN-xx, FIN-xx, OFF-xx) needs a passing test.
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
pnpm --filter @corex/school dev    # web 3000, school 3001, clinic 3002, finance 3003
pnpm test:e2e                      # Playwright + axe; needs `pnpm build` first
pnpm test:e2e --project=clinic     # one app
pnpm format                        # Prettier (with Tailwind class sorting)
pnpm db:local:start | stop | status | check   # local Supabase (Docker)
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
- `apps/web`: marketing site (Phase 4). Contact details live in `content/site.ts`; all copy goes in typed content files under `content/`. Motion and Lenis are allowed here only.
- `e2e/`: Playwright projects per app (`playwright.config.ts` starts each built app). `e2e/helpers.ts` enforces zero serious/critical axe violations (WCAG 2.2 AA tags), no horizontal overflow and 44px touch targets at 360/390/768/1440px.
- `supabase/`: local development stack only. Client schemas are migrated by `packages/db` (from Phase 2), never by the CLI's migration system. Tenancy is one Postgres schema per client with RLS through a per-schema `memberships` table (SPEC.md 4).

## Conventions

- Conventional Commits, one commit per block. Never force-push or rewrite pushed history.
- Accessibility, security headers, contrast and touch-target checks are part of every "done"; extend the e2e suite for new pages.
- No em-dash style decoration in UI copy; keep the mockup's copy and section order.

## Cloud sessions

`.claude/hooks/session-start.sh` installs dependencies and starts `dockerd` (it does not run by default in the container). Supabase images come from Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`) because `public.ecr.aws` is rate-limited there. Playwright must stay on 1.63.x to match the preinstalled Chromium.
