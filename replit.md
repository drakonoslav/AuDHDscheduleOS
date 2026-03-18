# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native mobile app — AuDHD Schedule OS. A local-first, neurodivergent-aware daily operating system.

**Three strictly separate concept layers (never collapsed into each other):**
1. `SchedulePhaseTag` — schedule block tags only: `expansion | structuring | recovery`
2. `NutritionPhaseId` — dietary regime: `base | carbup | carbcut | fatcut | recomp | deload | dietbreak | peakbulk`
3. `OrbitalPhaseId` — physiological interpretation layer: `priming | loading | accumulation | saturation | partitioning | resensitization | rebound | expression`

**Nutrition → Orbital translation table** (`data/nutritionToOrbitalMap.ts`): `base→expression/priming`, `carbup→loading/accumulation`, `carbcut→partitioning/resensitization`, `fatcut→partitioning/resensitization`, `recomp→partitioning/expression`, `deload→resensitization/priming`, `dietbreak→rebound/expression`, `peakbulk→saturation/accumulation`

**meal_template_id format:** `{nutritionPhaseId}_{mealSlot}` — e.g. `base_precardio` → `parseMealTemplateId()` splits it

**Key files:**
- `types/index.ts` — all types with clean layer separation documented
- `data/nutritionPhases.ts`, `data/orbitalPhases.ts`, `data/nutritionToOrbitalMap.ts`
- `data/mealSlotDefs.ts` — 7 canonical slots (precardio/postcardio/midmorning/prelift/postlift/evening/proteinreserve)
- `data/mealTemplates.ts` — compiled templates for base/carbup/recomp/deload phases with per-line ingredient data
- `data/ingredients.ts` — 8 ingredients: MCT, FLAX, OAT, DEXTRIN, WHEY, YOGURT, BANANA, EGG
- `context/AppContext.tsx` — full CRUD for blocks/snapshots/training logs
- `storage/storage.ts` — AsyncStorage persistence, deviation calculator, day score calculator
- `engine/recommendations.ts` — conservative pattern-backed recommendation engine (≥3 data points required)
- `app/(tabs)/` — 5 tabs: Today, Plan, Log, Meals, Insights

**Recommendation engine rules:** pattern-backed only (≥3 points), small timing shifts, distinguishes discipline failure vs state/schedule mismatch, protects recovery before optimization. Better adherence ≠ better schedule.

**Storage:** local-first with AsyncStorage, no backend. IDs use `Date.now().toString() + Math.random()`.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
