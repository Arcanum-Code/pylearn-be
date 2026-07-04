# pylearn-be

A backend service for PyLearn, an interactive platform to learn Python, built with Bun and Elysia.

## Features

- **Learning Materials:** Deliver structured Python learning content to students.
- **Interactive Quizzes:** Evaluate learning progress with assessments and quizzes.
- **User Dashboard:** Track student progress, quiz scores, and account activity.
- **Secure Authentication:** Email/password login with JWT access and refresh tokens.
- **Role-Based Access Control:** Granular per-feature permissions (e.g., managing materials, quizzes) with middleware enforcement.
- **User Management:** Administrative tools for full user CRUD operations.

## Getting Started

```bash
git clone https://github.com/titanic/pylearn-be.git
cd pylearn-be
bun install
cp .env.example .env
bun prisma:generate
bun prisma:migrate dev
bun run dev
```

Open [http://localhost:4000/openapi](http://localhost:4000/openapi) to view the API documentation.

## Environment Variables

| Variable                 | Description                             | Required |
| ------------------------ | --------------------------------------- | -------- |
| `NODE_ENV`               | Environment mode                        | Yes      |
| `LOG_LEVEL`              | Logging level                           | No       |
| `PORT`                   | Server port                             | No       |
| `CORS_ORIGIN`            | Allowed CORS origin                     | Yes      |
| `DATABASE_URL`           | PostgreSQL connection URL               | Yes      |
| `JWT_ACCESS_SECRET`      | JWT access token secret (min 32 chars)  | Yes      |
| `JWT_ACCESS_EXPIRES_IN`  | Access token expiry                     | Yes      |
| `JWT_REFRESH_SECRET`     | JWT refresh token secret (min 32 chars) | Yes      |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry                    | Yes      |

## Tech Stack

- [Bun](https://bun.sh/) — runtime
- [Elysia](https://elysia.dev/) — framework
- [Prisma](https://www.prisma.io/) — database ORM
- [PostgreSQL](https://www.postgresql.org/) — database
- [Zod](https://zod.dev/) — validation

## License

[MIT](LICENSE.md)
