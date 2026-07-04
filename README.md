# pylearn-be

Backend API for PyLearn — an interactive platform where students learn Python through structured materials, leveled quizzes, and real-time progress tracking.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Development](#development)
- [Docker](#docker)
- [Tech Stack](#tech-stack)
- [License](#license)

## Features

- **Structured Learning Materials:** Organize Python content into groups with sequenced lessons, rich-text and file-based materials, and per-student read tracking.
- **Leveled Quiz System:** Create multi-question quizzes with keyword-based grading, configurable pass thresholds, material prerequisites, and timed availability windows.
- **Student Groups & Enrollment:** Group students into cohorts, manage enrollments, and scope materials and quizzes per group.
- **Progress Dashboard:** Track quiz scores, material completion, and overall student progress with aggregated analytics.
- **JWT Authentication:** Secure login with short-lived access tokens and rotated refresh tokens, plus automatic nightly pruning of expired tokens.
- **Role-Based Access Control:** Granular per-feature permissions (create, read, update, delete, print) assigned to roles and enforced via middleware.
- **Internationalization:** Full i18n support with `Accept-Language` header detection and per-module locale files.
- **OpenAPI Documentation:** Auto-generated interactive API docs powered by `@elysiajs/openapi`.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [PostgreSQL](https://www.postgresql.org/) 16+

### Setup

```bash
git clone https://github.com/arcanum-code/pylearn-be.git
cd pylearn-be
bun install
cp .env.example .env        # edit with your database credentials and secrets
bun run prisma:generate      # generate Prisma client
bun run prisma:migrate       # run database migrations
bun run dev                  # start dev server with hot reload
```

Open [http://localhost:4000/openapi](http://localhost:4000/openapi) to browse the API documentation.

## Environment Variables

Copy `.env.example` and fill in the values:

| Variable                 | Description                             | Required | Default       |
| ------------------------ | --------------------------------------- | -------- | ------------- |
| `NODE_ENV`               | Environment mode (`development` / `production`) | Yes | `development` |
| `LOG_LEVEL`              | Pino log level (`debug`, `info`, `warn`, `error`) | No | `info` |
| `PORT`                   | Server port                             | No       | `4000`        |
| `CORS_ORIGIN`            | Allowed CORS origin                     | Yes      | —             |
| `DATABASE_URL`           | PostgreSQL connection string            | Yes      | —             |
| `JWT_ACCESS_SECRET`      | Access token signing secret (min 32 chars) | Yes   | —             |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifetime (e.g. `15m`)      | Yes      | —             |
| `JWT_REFRESH_SECRET`     | Refresh token signing secret (min 32 chars) | Yes  | —             |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`)      | Yes      | —             |

## Project Structure

```
src/
├── config/          # Environment and app configuration
├── libs/            # Shared libraries (Prisma client, logger, response helpers)
├── locales/         # Global i18n translations
├── middleware/      # Error handling and request logging
├── plugins/         # Elysia plugins (OpenAPI, rate limiting)
├── modules/         # Feature modules (see below)
│   ├── auth/        # Login, register, token refresh, logout
│   ├── user/        # User CRUD and profile management
│   ├── rbac/        # Roles, features, and permission management
│   ├── dashboard/   # Analytics and progress aggregation
│   ├── materials/   # Learning content management
│   ├── quiz/        # Quiz creation, attempts, and grading
│   ├── group/       # Student group management
│   ├── student/     # Student-specific views and actions
│   └── health/      # Health check endpoint
├── utils/           # Shared utility functions
└── server.ts        # Application entrypoint
```

Each module follows a consistent structure:

| File          | Purpose                                       |
| ------------- | --------------------------------------------- |
| `index.ts`    | Elysia route handlers and middleware wiring    |
| `service.ts`  | Business logic with injected Pino logger       |
| `model.ts`    | TypeBox schemas for OpenAPI documentation      |
| `schema.ts`   | Zod validation schemas for request/response    |
| `error.ts`    | Custom error classes for the module            |
| `locales/`    | Module-specific i18n translation files         |

## Development

```bash
bun run dev              # start dev server with file watcher
bun run lint             # lint all source files
bun run lint:fix         # lint and auto-fix
bun run format           # format with Prettier
bun run build            # production build to dist/
```

### Testing

Tests run against a real PostgreSQL database (no mocking):

```bash
bun run test:setup       # push schema to test database
bun run test:unit        # run unit tests
bun run test:int         # run integration tests
```

### Database

```bash
bun run prisma:generate  # regenerate Prisma client after schema changes
bun run prisma:migrate   # create and apply a new migration
bun run prisma:deploy    # apply pending migrations (production)
bun run prisma:reset     # reset database and re-run all migrations
```

## Docker

Run the full stack (backend + PostgreSQL + frontend + Caddy reverse proxy):

```bash
docker compose up -d
```

The Compose file starts four services:

| Service    | Image                                  | Purpose              |
| ---------- | -------------------------------------- | -------------------- |
| `app`      | `ghcr.io/arcanum-code/pylearn-be:main` | Backend API          |
| `db`       | `postgres:16`                          | PostgreSQL database  |
| `frontend` | `ghcr.io/arcanum-code/pylearn-fe:main` | Frontend application |
| `caddy`    | `caddy:2`                              | Reverse proxy + TLS  |

## Tech Stack

- [Bun](https://bun.sh/) — JavaScript runtime
- [Elysia](https://elysia.dev/) — web framework
- [Prisma](https://www.prisma.io/) — database ORM
- [PostgreSQL](https://www.postgresql.org/) — relational database
- [Zod](https://zod.dev/) — schema validation
- [Pino](https://getpino.io/) — structured logging
- [TypeBox](https://github.com/sinclairzx81/typebox) — OpenAPI schema generation (via prismabox)

## License

MIT
