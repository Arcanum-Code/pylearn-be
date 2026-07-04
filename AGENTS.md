# pylearn-be

TypeScript-based backend for the PyLearn platform using Bun, Elysia, and Prisma ORM.

## Commands
- `bun run dev` - Start dev server with hot reload
- `bun test` - Run all tests (real database)
- `bun build src/server.ts --outdir dist --target bun --external @prisma/client` - Build production server
- `bun run lint` - Run ESLint
- `bun run format` - Format with Prettier
- `prisma generate` - Generate Prisma client
- `prisma migrate dev` - Run migrations in dev

## Gotchas
- **IMPORTANT**: **Never log passwords, tokens, or sensitive data.**
- Always implement logging exclusively in the Service Layer using the injected `pino` logger (`log.debug`, `log.info`, etc.).
- Use `bun:test` with a real database (no mocking). Always call `resetDatabase()` in `beforeEach()`.
- Use custom error classes from `@/libs/exceptions` instead of generic errors.
- Never use `any`. Use `unknown` or specific types instead.
- Rotate refresh tokens on use and increment `tokenVersion` on `logout_all` or password change.

## Conventions
- **Imports**: Use path aliases (`@/*` for `src/*`, `@modules/*`, etc.). Stdlib first, third-party second, local last.
- **Naming**: Classes (`PascalCase`), Functions/Vars (`camelCase`), Constants (`SCREAMING_SNAKE_CASE`), Files (`kebab-case`).
- **i18n**: Common locales in `src/locales/`, module-specific in `src/modules/[name]/locales/`. Send `Accept-Language` header for frontend requests.

## References
- @.claude/architecture.md
