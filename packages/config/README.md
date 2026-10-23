# @corex/config

Shared tooling configuration for every Corex workspace.

| Export                                      | Use                                                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@corex/config/tsconfig/base.json`          | Strict TypeScript base (`noUncheckedIndexedAccess`, no implicit any)                                                                                     |
| `@corex/config/tsconfig/nextjs.json`        | Next.js apps                                                                                                                                             |
| `@corex/config/tsconfig/react-library.json` | React packages such as `@corex/ui`                                                                                                                       |
| `@corex/config/eslint`                      | ESLint flat config: Next core-web-vitals, TypeScript (type-aware), jsx-a11y strict, no `any`, no `console`                                               |
| `@corex/config/vitest`                      | `corexVitest({ environment })` base options; jsdom setup adds jest-dom matchers                                                                          |
| `@corex/config/next`                        | `withCorex(nextConfig, csp)` adds security headers (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors) and transpiles `@corex/ui` |

Prettier is configured once at the repo root (`prettier.config.mjs`).

## Usage

```js
// eslint.config.mjs
import corex from "@corex/config/eslint";
export default corex;
```

```ts
// next.config.ts
import { withCorex } from "@corex/config/next";
export default withCorex({}, { connectSrc: [process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""] });
```

## Test

```bash
pnpm --filter @corex/config test
```
