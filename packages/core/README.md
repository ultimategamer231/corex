# @corex/core

Shared logic for the School, Clinic and Finance apps (SPEC.md 5). Import by path.

| Module                                    | What it does                                                                                                                                                                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@corex/core/money`                       | Money as bigint minor units + currency (CORE-04): parse, format (`US$1,234.50`, `L$...`), add (same currency only), per-currency totals (CORE-05), line amounts and conversion with an explicit saved rate, rounded half away from zero like the database |
| `@corex/core/billing`                     | Validated calls to the database billing functions: `issueInvoice`, `recordPayment` (idempotent by client payment id, CORE-06), `voidPayment`, `voidInvoice` (reason required, CORE-07)                                                                    |
| `@corex/core/auth`                        | `requireMember(supabase, { roles, sessionHours })`: signed-in user with an active membership in this schema, role check before writes (CORE-02), session limits (8h school/finance, 4h clinic)                                                            |
| `@corex/core/settings`                    | Loads the `settings` row (CORE-01)                                                                                                                                                                                                                        |
| `@corex/core/env`                         | Validated per-instance environment (SPEC.md 4.2)                                                                                                                                                                                                          |
| `@corex/core/supabase/server`, `/browser` | Supabase clients created with the instance's schema                                                                                                                                                                                                       |
| `@corex/core/offline`                     | Offline outbox (SPEC.md 10): per-user IndexedDB, sync with created/exists handling, failed items kept with their error, `destroy()` on logout, `startAutoSync`                                                                                            |
| `@corex/core/dates`                       | Date formatting in Africa/Monrovia                                                                                                                                                                                                                        |

The money rules themselves live in the database (`packages/db/core/migrations/0004_billing.sql`); this package validates input and maps results.

```bash
pnpm --filter @corex/core test
```
