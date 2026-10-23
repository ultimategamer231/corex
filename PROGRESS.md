# PROGRESS

Running log for the Corex MVP build. Read this first at the start of every session.

## Current status

- **Phase:** 1 — Foundation (SPEC.md Step 1)
- **Block:** 1.7 complete
- **Branch:** `claude/questions-clarity-qmgcs5` (Phase 1 branch; merge to `main` after the owner approves the phase report)

## Block log

- **1.1** (2026-10-23) Repo bootstrap: pnpm workspace, Turborepo, Prettier, docs (SPEC, mockup), README, PROGRESS.
- **1.2** (2026-10-23) `packages/config`: strict tsconfig bases, ESLint flat config (type-aware, jsx-a11y strict, no `any`/`console`), Vitest base, `withCorex` security headers. 9 tests.
- **1.3** (2026-10-23) `packages/ui`: Tailwind v4 theme tokens (SPEC + mockup, default palette removed), shadcn-pattern Button, Badge, Card, Input, Label, Dialog, Sheet, DropdownMenu, Toaster, Skeleton; Corex logo SVG; fonts. 56 tests including token contrast.
- **1.4** (2026-10-23) App shell (SPEC 5.4): dark sidebar collapsible to an icon rail (per-device preference), mobile bottom bar with "More" sheet, top bar with org name/logo from props (settings in Phase 3), online/offline badge with pending-sync count (live region), user menu, skip link. 70 tests.
- **1.5** (2026-10-23) Four Next.js 16 apps: `school`, `clinic`, `finance` render the shell with placeholder sections (static, 404 for unknown sections); `web` has a placeholder home with logo, real contacts (`content/site.ts`) and WhatsApp/tel links. Shared security headers verified on a running build. `.env.example`, `vercel.json` (turbo-ignore) and README per app. Official logo cropped to `apps/web/public/brand/corex-logo.png`. 14 app tests; all four builds pass.
- **1.6** (2026-10-23) Playwright 1.63 + axe (WCAG 2.2 AA tags): every app at 360/390/768/1440px checks zero serious/critical violations, no horizontal scroll, 44px touch targets, skip link, sidebar collapse persistence, mobile More sheet (Escape returns focus), offline badge via `context.setOffline`, keyboard user menu, 404s and security headers. Fixed two WCAG 2.5.3 label-in-name issues axe found (user menu, logo link). 40 e2e tests.
- **1.7** (2026-10-23) Local Supabase: CLI 2.122 as dev dependency, `supabase/config.toml` (sign-up off, 8-char mixed passwords, unused services off), `pnpm db:local:start|stop|status|check` wrapper (Docker Hub images), `docs/local-dev.md`, SessionStart hook for cloud sessions (pnpm install, start dockerd). Verified: auth and REST return 200, `psql` connects to Postgres 17.11.

## Owner answers (2026-10-23)

- Ask for confirmation before merging at the end of each phase; send screenshots when a phase includes UI.
- Install essential dependencies without asking; ask when a dependency is risky or critical.
- Leads storage: `corex_web` lives in its own Supabase project; the website server may use that project's service-role key (server-only). Rate limiting uses a Postgres table, not a new service.
- The LCC records system is out of scope for the MVP and moves to version 2. The School app is built from SPEC.md alone.
- Contacts: primary WhatsApp **+231 770 021 026**; also +231 775 178 905 and +231 777 352 002 (calls or WhatsApp).
- Address: Carey & Johnson Street, Monrovia, Liberia.
- Email: no real address yet. Use `info@cds.com` as a **placeholder** (see open questions).
- Logo: the supplied image is the official logo (`apps/web/public/brand/corex-logo.png`); the mockup's SVG mark matches it and is used for crisp rendering.

## Decisions made on the owner's behalf

| #   | Decision                                                                                                                                   | Reason                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Lighthouse targets follow the prompt's Section 7 (Perf ≥ 90; A11y, Best Practices, SEO ≥ 95), stricter than SPEC 6.7                       | Prompt Section 3 makes Section 7 part of every "Done when"                                                                       |
| D2  | Extra theme tokens beyond SPEC 5.4 (surface, primary-darker, ink-soft, border-subtle, border-strong, on-dark, warning, info, chart-2)      | The mockup uses ~20 more colors; tokens keep them consistent. SPEC's 9 tokens stay canonical                                     |
| D3  | Footer uses `primary-darker` `#052F2D` (mockup) instead of `primary-dark`                                                                  | Separates the footer from the dark CTA band above it                                                                             |
| D4  | `border-strong` `#7E918F` for form controls                                                                                                | `#D9E3E2` is 1.3:1 on white and fails WCAG 1.4.11 (needs 3:1)                                                                    |
| D5  | Tailwind v4 CSS-first theme in `packages/ui/src/styles/theme.css` instead of a JS "tailwind preset" in `packages/config`                   | Tailwind v4 has no JS preset; `packages/config` holds tsconfig, ESLint, Prettier, Vitest and Next.js config                      |
| D6  | Phase 1 creates four minimal Next.js apps (no features)                                                                                    | The shell needs a host to render; CI and Vercel need real targets                                                                |
| D7  | Tool versions: TypeScript 6.0, ESLint 9.39, Vitest 4.1, Playwright 1.63                                                                    | Newest majors (TS 7, ESLint 10) are not yet supported by typescript-eslint / jsx-a11y; Playwright matches the installed browsers |
| D8  | Baseline CSP uses `'unsafe-inline'` for scripts and styles (no nonces) in Phase 1                                                          | Nonces force dynamic rendering. Revisit per app: apps (auth, dynamic) in Phase 3, website in Phase 4                             |
| D9  | Design-skill conflicts resolved in favor of SPEC: Inter and lucide-react kept (SPEC 2, 5.4); no dark mode (SPEC defines light tokens only) | SPEC outranks skills                                                                                                             |
| D10 | `typedRoutes` off in all apps                                                                                                              | The shared shell passes string hrefs to `next/link`; typed routes would reject them. Revisit if apps need it                     |
| D11 | jsdom 29 instead of 30                                                                                                                     | jsdom 30 needs Node 22.22.2+; this environment has 22.22.0                                                                       |
| D12 | Top bar spans the full width with the sidebar below it                                                                                     | Matches the mockup's AppPreview layout                                                                                           |

## Planned deviations from the mockup (Phase 4)

- Desktop "Services" nav item becomes a dropdown of the three services (mockup links straight to AI Automation; there is no `/services` index).
- On-request intro: drop "There is no demo yet" (SPEC 6.4 forbids a "coming soon" label). Finance FAQ: drop "planned for a later version" (SPEC 13).
- Product pages gain a Screenshots section (SPEC 6.3); AppPreview illustrations until real demo screenshots exist (Phases 7, 9, 11).
- Footer social links (SPEC 6.2) render only when set in `content/site.ts`.
- `/work` hidden from nav, footer and home when no published use cases; route 404s in production.
- Privacy draft: omit "We record which demo roles are used" unless cookie-free analytics is approved.
- Contact form: product options from the mockup, `?product=` prefill, honeypot field, plan radio optional (empty saved as `unsure`).

## Audit findings and fixes

_None yet (Phase 1 has no previous phase to audit)._

## Open questions for the owner

1. **`BUSINESS.md` not received.** Needed before Phase 4 to confirm pricing copy (mockup prices are used until then).
2. **Placeholder email `info@cds.com`.** `cds.com` is a registered domain owned by someone else; mail sent to it would reach them. It stays a marked placeholder in content and must be replaced before the site goes public.
3. **Later-phase gaps** (to be raised in those phases' plans): per-app session timeout when demos share one Supabase project (5.3); cross-currency transfers (FIN-04); whether demo visitors may approve seeded records (11.3); notification email provider (6.6); backup storage provider (4.5); Vercel Pro plan before going public.
