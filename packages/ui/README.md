# @corex/ui

Corex theme tokens, shadcn/ui-pattern components and the app shell, shared by the website and all apps.

## Theme

`src/styles/theme.css` defines every color, font, radius and shadow as a Tailwind v4 theme token. Tailwind's default palette is removed, so only Corex tokens can be used (`bg-primary`, `text-ink`, `bg-accent text-accent-foreground`, ...). A test checks that the SPEC.md 5.4 values are unchanged and that every text/background pair used by components meets WCAG AA contrast.

```css
/* app/globals.css */
@import "tailwindcss";
@import "@corex/ui/styles/theme.css";
```

Fonts (Inter and Plus Jakarta Sans via `next/font`):

```tsx
import { fontVariables } from "@corex/ui/fonts";
<html lang="en" className={fontVariables}>
```

Add `@corex/ui` to `transpilePackages` (done by `withCorex` from `@corex/config/next`).

## Components

Import by path, for example `import { Button } from "@corex/ui/components/button"`.

| Component               | Notes                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button`                | Variants `accent` (single primary CTA only), `primary`, `outline`, `secondary`, `ghost`, `link`, `danger`. All sizes are at least 44px tall. Supports `asChild`. |
| `badge`                 | `neutral`, `brand`, `warning`, `info`, `danger`                                                                                                                  |
| `card`                  | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`                                                                                |
| `input`, `label`        | Strong 3:1 border; set `aria-invalid` for the error state                                                                                                        |
| `dialog`, `sheet`       | Radix dialog; 200ms fade/zoom or slide, off under reduced motion                                                                                                 |
| `dropdown-menu`         | Radix menu with 44px items                                                                                                                                       |
| `sonner`                | `Toaster` and `toast` for transient messages                                                                                                                     |
| `separator`, `skeleton` |                                                                                                                                                                  |

Brand: `import { CorexLogo, CorexMark } from "@corex/ui/brand"`.

Shell: see `src/shell/` (`AppShell`, sidebar, bottom bar, top bar, online badge).

## Adding components

Components follow shadcn/ui (new-york, Tailwind v4) and are adapted to Corex tokens. `components.json` is set up so `pnpm dlx shadcn@latest add <name>` can be run from this folder; always re-map the generated classes to Corex tokens.

## Test

```bash
pnpm --filter @corex/ui test
```
