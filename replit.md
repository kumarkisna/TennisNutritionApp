# Clear Access

A daily food planner with a standalone, device-local mobile app. The existing web planner and backend are retained separately.

## Pinned links

- Published web app: [https://website-with-google-sign-in.replit.app](https://website-with-google-sign-in.replit.app)
- Expo Go launch page (not a Median WebView app page): [https://website-with-google-sign-in.replit.app/clear-access-mobile/](https://website-with-google-sign-in.replit.app/clear-access-mobile/)
- Median browser build (opens directly to Planner after publishing): [https://website-with-google-sign-in.replit.app/clear-access-mobile/web/](https://website-with-google-sign-in.replit.app/clear-access-mobile/web/)

## Mobile product direction

- The mobile app must work independently using local device storage, without sign-in, server requests, or cloud synchronization.
- The Median browser build stores its local data in the WebView's browser storage, separate from Expo Go's native app storage; native background meal alerts are unavailable in that WebView.
- Appearance is a device-wide, explicitly selected theme, independent of each person's nutrition settings. Store its identifier separately from planner records; restoring a planner backup does not replace the device's appearance.
- **Why:** The requested mobile product is local-only, rather than a companion that depends on the existing web accounts.
- Keep people, food records, meal plans, activity selections, preferences, and dated height measurements on the device. Search the local food library, not an online discovery service.
- Do not automatically move or erase existing web-account data. Clearing mobile app storage removes the local records.
- Preserve explicit storage errors instead of silently resetting or overwriting unreadable data.
- AsyncStorage-backed queries and mutations must use React Query's `networkMode: 'always'`; its default online mode pauses even device-only saves when the network is unavailable.
- Existing planner storage is migrated in place for height records and optional date-of-birth/reference-sex fields. Keep the established storage namespace and preserve old food, person, meal, and activity data.
- Mobile nutrition targets use saved weight and the selected day's sport activity, not the retained legacy calorie baseline/multiplier. Calorie/fat estimates use disclosed adult planning assumptions; require an adult age, with date of birth taking precedence when supplied. Iron and any saved manual fat goal keep their own provenance and are not automatic targets.
- Height charts bundle the actual CDC 2000 stature-for-age dataset locally. CDC comparisons require an explicit boys'/girls' reference selection and date of birth, and apply only at measured ages 2–20. Height history remains available for every saved measurement; never extrapolate growth percentiles or describe percentile curves as health requirements.

## Run & Operate

- `pnpm --filter @workspace/clear-access-mobile run dev` — run the standalone Expo mobile app through its managed workflow; no API or Clerk configuration is needed
- `pnpm --filter @workspace/api-server run dev` — run the API server (uses `PORT`)
- `pnpm --filter @workspace/google-signin run dev` — run the web frontend through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Existing web/backend env: `DATABASE_URL` — Postgres connection string; Clerk keys are provisioned by Replit-managed Auth

## Stack

- Mobile: Expo / React Native, AsyncStorage persistence; React Query coordinates local reads and writes without networking
- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Web auth: Replit-managed Clerk with Google SSO

## Where things live

- `artifacts/google-signin/src/` — public entry, OAuth sign-in and signed-in portal
- `artifacts/api-server/src/app.ts` — Clerk middleware and proxy wiring
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — production Clerk proxy
- `artifacts/api-server/src/routes/` — per-user food catalog, meal planning, daily summaries, and activity settings
- `lib/db/src/schema/` — foods, planned portions, and per-user preferences

## Architecture decisions

- Web sign-in is delegated to Clerk and Google's OAuth provider; this application never handles Google passwords.
- The web public root page stays accessible while signed-out users can enter through the sign-in route. Signed-in users are redirected to the portal.
- The API server mounts the Clerk proxy before body parsers so auth remains available in published builds.
- Existing web/backend reference foods are seeded idempotently at API startup. Per-100 g values are approximate; users can add their own foods. That web planner's daily target remains an editable baseline adjusted by an activity multiplier, distinct from the mobile app's weight-and-day-activity estimates.

## Product

The mobile app opens directly into the overview, with a day-by-day meal planner, local per-100 g food catalog, people profiles, nutrition preferences, and dated height tracking with CDC references. Everything is saved per device. The existing web app separately retains its Google sign-in and per-account data.

## User preferences

The original web app uses Google's official OAuth sign-in rather than collecting Gmail passwords. This does not apply to the local-only mobile app.

## Gotchas

- Verify Google SSO is enabled for both Development and Production in the Auth pane when preparing to publish.
- Clerk proxy routing and the `/sign-in/*?` and `/sign-up/*?` callback routes are required for OAuth to complete.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
