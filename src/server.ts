import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { openapiPlugin } from "./plugins/openapi";
import {
  user,
  health,
  auth,
  rbac,
  dashboard,
  materials,
  quizzes,
  group,
  student,
  lecturer,
} from "./modules";
import { prisma } from "./libs/prisma";
import { logger } from "./libs/logger";
import { globalRateLimit } from "./plugins/rate-limit";
import { env } from "./config/env";
import { helmet } from "elysia-helmet";
import { globalErrorHandler } from "./middleware/error";
import { loggerMiddleware } from "./middleware/logger";
import cron from "@elysiajs/cron";
import { AuthService } from "./modules/auth/service";
import staticPlugin from "@elysiajs/static";
import { join } from "path";

const port = Number(env.PORT ?? 3000);

export const app = new Elysia()
  .use(
    cors({
      origin: env.NODE_ENV === "production" ? env.CORS_ORIGIN : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept-Language",
        "accept-language",
      ],
      exposedHeaders: ["Content-Language"],
    }),
  )
  .use(loggerMiddleware)
  .use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          connectSrc: ["'self'"],
        },
      },
    }),
  )
  .use(
    staticPlugin({
      assets: join(process.cwd(), "storage"),
      prefix: "/storage",
    }),
  )
  .use(globalRateLimit)
  .use(
    cron({
      name: "prune-expired-tokens",
      pattern: "0 3 * * *",
      async run() {
        await AuthService.pruneExpiredTokens(logger);
      },
    }),
  )
  .use(openapiPlugin)
  .use(health)
  .use(auth)
  .use(rbac)
  .use(user)
  .use(dashboard)
  .use(materials)
  .use(quizzes)
  .use(group)
  .use(student)
  .use(lecturer)
  .use(globalErrorHandler)
  .listen({
    port,
    hostname: "0.0.0.0",
  });

logger.info(
  {
    url: `http://${app.server?.hostname}:${app.server?.port}`,
    env: process.env.NODE_ENV,
  },
  "🦊 Elysia server started",
);

// ----------------------
// Graceful shutdown
// ----------------------
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Signal received. Starting graceful shutdown...");

  try {
    // Stop accepting new connections
    app.server?.stop();
    logger.info("HTTP server stopped accepting new connections");

    // Disconnect Prisma (waits for queries to finish)
    logger.info("Disconnecting database...");
    await prisma.$disconnect();

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (err) {
    logger.error({ err, signal }, "❌ Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export type App = typeof app;
