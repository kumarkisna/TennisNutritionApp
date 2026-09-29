# Clear Access

A private daily food planner reached through Google's official OAuth flow. The site never asks for a Google password.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (uses `PORT`)
- `pnpm --filter @workspace/google-signin run dev` — run the web frontend through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; Clerk keys are provisioned by Replit-managed Auth

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: Replit-managed Clerk with Google SSO

## Where things live

- `artifacts/google-signin/src/` — public entry, OAuth sign-in and signed-in portal
- `artifacts/api-server/src/app.ts` — Clerk middleware and proxy wiring
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — production Clerk proxy
- `artifacts/api-server/src/routes/` — per-user food catalog, meal planning, daily summaries, and activity settings
- `lib/db/src/schema/` — foods, planned portions, and per-user preferences

## Architecture decisions

- Sign-in is delegated to Clerk and Google's OAuth provider; this application never handles Google passwords.
- The public root page stays accessible while signed-out users can enter through the sign-in route. Signed-in users are redirected to the portal.
- The API server mounts the Clerk proxy before body parsers so auth remains available in published builds.
- Reference foods are seeded idempotently at API startup. Per-100 g values are approximate; users can add their own foods. The daily target is an editable baseline adjusted by an activity multiplier, not individualized medical advice.

## Product

Visitors can learn about the planner and continue with Google. Signed-in users can navigate an overview, a day-by-day meal planner, a per-100 g food catalog with custom entries, and activity settings. Plans and preferences are saved per user.

## User preferences

The user chose Google's official OAuth sign-in rather than a page that collects Gmail passwords.

## Gotchas

- Verify Google SSO is enabled for both Development and Production in the Auth pane when preparing to publish.
- Clerk proxy routing and the `/sign-in/*?` and `/sign-up/*?` callback routes are required for OAuth to complete.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
