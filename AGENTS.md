# pylearn-be

Backend API for the PyLearn platform. Bun + Elysia + Prisma + PostgreSQL.

## Commands
- `bun run dev` - Start dev server with hot reload
- `bun run test:setup` - Push schema to test database (run once before tests)
- `bun run test:unit` - Run unit tests
- `bun run test:int` - Run integration tests
- `bun run build` - Build production bundle to `dist/`
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Lint and auto-fix
- `bun run format` - Format with Prettier
- `bun run prisma:generate` - Generate Prisma client (run after schema changes)
- `bun run prisma:migrate` - Create and apply migration in dev
- `bun run prisma:reset` - Reset database and re-run all migrations

## Setup
Requires Bun v1.0+ and PostgreSQL 16+.
```bash
bun install
cp .env.example .env          # fill in DATABASE_URL and JWT secrets
bun run prisma:generate
bun run prisma:migrate
```

## Gotchas
- **IMPORTANT: Never log passwords, tokens, or sensitive data.** All logging goes through the injected `pino` logger in the Service Layer (`log.debug`, `log.info`, etc.) — never log in route handlers.
- **IMPORTANT: Never use `any`.** Use `unknown` or a specific type instead.
- Tests run against a real PostgreSQL database — no mocking. Always call `resetDatabase()` in `beforeEach()` and import test helpers from `src/__tests__/test_utils.ts`.
- Run `bun run test:setup` before the first test run to push the schema to the test database (uses `.env.test`).
- Use custom error classes from `@/libs/exceptions` (global) or `src/modules/[name]/error.ts` (module-specific) — never throw raw `Error`.
- Use `createBaseApp()` for public routes (login, register, health) and `createProtectedApp()` for authenticated routes — both are in `@/libs/base`.
- Always use `successResponse()` / `errorResponse()` from `@/libs/response` — never return raw objects from route handlers.
- Rotate refresh tokens on use. Increment `tokenVersion` on `logout_all` or password change.

## Conventions
- **Imports**: Path aliases only — `@/*` maps to `src/*` (e.g. `@/libs/prisma`, `@/modules/auth/service`). Order: stdlib → third-party → local.
- **Naming**: Classes `PascalCase`, functions/vars `camelCase`, constants `SCREAMING_SNAKE_CASE`, files `kebab-case`.
- **Module anatomy**: Each module in `src/modules/[name]/` has `index.ts` (routes), `service.ts` (logic), `model.ts` (TypeBox/OpenAPI), `schema.ts` (Zod validation), `error.ts` (errors), `locales/` (i18n).
- **i18n**: Common translations in `src/locales/`, module-specific in `src/modules/[name]/locales/`. Extract `locale` in handlers and pass it to response helpers.
- **Tests**: Place in `src/__tests__/[feature]/`. Use `getAuthToken()` and `createTestUser()` from `test_utils.ts` for protected routes.

## References
- @.claude/architecture.md
