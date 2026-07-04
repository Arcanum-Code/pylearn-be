# Architecture and Module Structure

## Module Anatomy
The project uses a feature-based structure located in `src/modules/[name]/`:
- `index.ts`: Elysia route handlers and middleware application
- `service.ts`: Core business logic with injected Pino logger
- `model.ts`: TypeBox schemas for OpenAPI documentation
- `schema.ts`: Zod validation schemas for inputs/outputs
- `error.ts`: Custom error classes specific to the module
- `locales/`: Module-specific i18n translations

## Core Libraries
- **Base App**: Use `createBaseApp` and `createProtectedApp` from `@/libs/base`
- **Responses**: Always use `successResponse` and `errorResponse` from `@/libs/response` for standard formatting and i18n
- **Logging**: Inject Pino logger from `@/libs/logger` into service layer methods
- **Database**: Import singleton Prisma client from `@/libs/prisma`

## i18n Implementation
- Common translations (e.g. generic validation errors) go in `src/locales/`
- Feature-specific translations go in `src/modules/[name]/locales/`
- Route handlers must extract `locale` and pass it to response helpers

## Testing Utilities
- Place tests in `src/__tests__/[feature]/`
- Use `getAuthToken()` from `test_utils.ts` for protected route testing
- Use `createTestUser()` from `test_utils.ts` for mocking authenticated contexts
- Run tests against a real Postgres instance initialized via `.env.test`
