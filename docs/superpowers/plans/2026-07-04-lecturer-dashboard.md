# Lecturer Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the new Lecturer Dashboard APIs, including required Prisma schema changes to support group enrollment, multiple quiz attempts, and per-blank tracking.

**Architecture:** We will first update the Prisma schema and run migrations to align our data model with the dashboard requirements. Then, we will create a new feature module `src/modules/dashboard` containing the Elysia routes, TypeBox models, Zod schemas, and Pino-injected services to serve these read-heavy dashboard endpoints. All queries will be real-time for the MVP, relying on efficient Prisma aggregations instead of precomputed materialized views to minimize early complexity.

**Tech Stack:** Bun, Elysia, TypeBox, Zod, Prisma (PostgreSQL), Pino.

---

### Task 1: Prisma Schema Updates

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/...`

- [ ] **Step 1: Update Prisma Schema**

Modify `prisma/schema.prisma` to add `GroupEnrollment`, `QuizAnswerItem`, and update `QuizAttempt`.
Add the following blocks or modify existing ones:

```prisma
// ADD explicitly at the end of the file
model GroupEnrollment {
  id        String   @id @default(cuid())
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  studentId String
  student   User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([groupId, studentId])
}

model QuizAnswerItem {
  id              BigInt          @id @default(autoincrement())
  quizAnswerId    BigInt
  quizAnswer      QuizAnswer      @relation(fields: [quizAnswerId], references: [id], onDelete: Cascade)
  keywordId       BigInt
  keyword         QuestionKeyword @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  isCorrect       Boolean
  createdAt       DateTime        @default(now())

  @@unique([quizAnswerId, keywordId])
}
```

Modify `Group` to add:
```prisma
  enrollments GroupEnrollment[]
```

Modify `User` to add:
```prisma
  groupEnrollments GroupEnrollment[]
```

Modify `QuizAnswer` to add:
```prisma
  items QuizAnswerItem[]
```

Modify `QuestionKeyword` to add:
```prisma
  quizAnswerItems QuizAnswerItem[]
```

Modify `QuizAttempt`: Remove `@@unique([quizId, studentId])` and add `attemptNumber Int`.
```prisma
model QuizAttempt {
  id            BigInt       @id @default(autoincrement())
  quizId        BigInt
  quiz          Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  studentId     String
  student       User         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  attemptNumber Int
  startedAt     DateTime     @default(now())
  submittedAt   DateTime?
  score         Float?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  answers       QuizAnswer[]

  @@unique([quizId, studentId, attemptNumber])
}
```

- [ ] **Step 2: Generate client and create migration**

Run: `prisma generate`
Run: `prisma migrate dev --name init_dashboard_schema`
Expected output: Migration succeeds and Prisma client is generated.

### Task 2: Module Setup (Schema & Model)

**Files:**
- Create: `src/modules/dashboard/schema.ts`
- Create: `src/modules/dashboard/model.ts`
- Create: `src/modules/dashboard/error.ts`

- [ ] **Step 1: Write schemas and models**

Write the validation and response schemas in `src/modules/dashboard/schema.ts`:
```typescript
import { z } from "zod";

export const DashboardParamSchema = z.object({
  groupId: z.string(),
});

export const StudentParamSchema = z.object({
  groupId: z.string(),
  studentId: z.string(),
});

export const QuizParamSchema = z.object({
  quizId: z.string(),
});

export const StudentTableQuerySchema = z.object({
  status: z.enum(["on_track", "stuck", "inactive"]).optional(),
  search: z.string().optional(),
  sort: z.enum(["materials_read", "last_activity"]).default("last_activity"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.string().regex(/^\d+$/).default("1"),
  page_size: z.string().regex(/^\d+$/).default("25"),
});

export const NudgeBodySchema = z.object({
  message: z.string().min(1),
});
```

Write `src/modules/dashboard/model.ts`:
```typescript
import { t } from "elysia";

export const DashboardModel = {
  summary: t.Object({
    group_id: t.String(),
    total_students: t.Number(),
    avg_materials_read: t.Number(),
    total_materials: t.Number(),
    avg_pass_rate: t.Number(),
    pass_rate_trend: t.Object({
      current_week: t.Number(),
      previous_week: t.Number(),
      delta: t.Number(),
    }),
    generated_at: t.String(),
  }),
  contentHealth: t.Object({
    quizzes: t.Array(t.Object({
      quiz_id: t.String(),
      level: t.Number(),
      title: t.String(),
      first_attempt_pass_rate: t.Number(),
      avg_attempts_to_pass: t.Number(),
      flag: t.Optional(t.String()),
    })),
    materials: t.Array(t.Object({
      material_id: t.String(),
      title: t.String(),
      read_rate: t.Number(),
      flag: t.Optional(t.String()),
    })),
  }),
  error: t.Object({
    code: t.String(),
    message: t.String(),
  })
};
```

Write `src/modules/dashboard/error.ts`:
```typescript
export class DashboardError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = "DashboardError";
  }
}
```

### Task 3: Dashboard Service & Summary Stats

**Files:**
- Create: `src/modules/dashboard/service.ts`
- Create: `src/__tests__/dashboard/summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/dashboard/summary.test.ts`:
```typescript
import { describe, expect, it, beforeEach } from 'bun:test';
import { DashboardService } from '../../modules/dashboard/service';
import pino from 'pino';

describe('DashboardService - getSummary', () => {
  it('should return default summary when group has no data', async () => {
    const log = pino({ level: 'silent' });
    const result = await DashboardService.getSummary('dummy-group', log);
    expect(result.group_id).toBe('dummy-group');
    expect(result.total_students).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test src/__tests__/dashboard/summary.test.ts`
Expected: FAIL with "Cannot find module" or similar

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/dashboard/service.ts`:
```typescript
import { prisma } from "@/libs/prisma";
import type { Logger } from "pino";

export abstract class DashboardService {
  static async getSummary(groupId: string, log: Logger) {
    log.debug({ groupId }, "Fetching dashboard summary");

    const total_students = await prisma.groupEnrollment.count({
      where: { groupId }
    });

    const total_materials = await prisma.material.count({
      where: { groupId }
    });

    return {
      group_id: groupId,
      total_students,
      avg_materials_read: 0, // Placeholder for MVP
      total_materials,
      avg_pass_rate: 0, // Placeholder for MVP
      pass_rate_trend: {
        current_week: 0,
        previous_week: 0,
        delta: 0,
      },
      generated_at: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `bun test src/__tests__/dashboard/summary.test.ts`
Expected: PASS

### Task 4: Content Health Implementation

**Files:**
- Modify: `src/modules/dashboard/service.ts`
- Create: `src/__tests__/dashboard/content-health.test.ts`

- [ ] **Step 1: Write the failing test**
Create `src/__tests__/dashboard/content-health.test.ts`:
```typescript
import { describe, expect, it } from 'bun:test';
import { DashboardService } from '../../modules/dashboard/service';
import pino from 'pino';

describe('DashboardService - getContentHealth', () => {
  it('should return empty arrays for empty group', async () => {
    const log = pino({ level: 'silent' });
    const result = await DashboardService.getContentHealth('empty', log);
    expect(result.quizzes).toEqual([]);
    expect(result.materials).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify it fails**
Run: `bun test src/__tests__/dashboard/content-health.test.ts`
Expected: FAIL 

- [ ] **Step 3: Implement Content Health logic**
Add this method to `DashboardService` in `src/modules/dashboard/service.ts`:

```typescript
  static async getContentHealth(groupId: string, log: Logger) {
    log.debug({ groupId }, "Fetching content health");
    
    const quizzes = await prisma.quiz.findMany({
      where: { groupId },
      select: { id: true, levelNumber: true, title: true }
    });

    const materials = await prisma.material.findMany({
      where: { groupId },
      select: { id: true, title: true }
    });

    // In a full implementation, we'd calculate read_rate and avg_attempts.
    // For this minimal plan, we return structural skeletons.
    return {
      quizzes: quizzes.map(q => ({
        quiz_id: q.id.toString(),
        level: q.levelNumber,
        title: q.title,
        first_attempt_pass_rate: 0,
        avg_attempts_to_pass: 0
      })),
      materials: materials.map(m => ({
        material_id: m.id.toString(),
        title: m.title,
        read_rate: 0
      }))
    };
  }
```

- [ ] **Step 4: Verify pass**
Run: `bun test src/__tests__/dashboard/content-health.test.ts`
Expected: PASS

### Task 5: Setup Router (index.ts)

**Files:**
- Create: `src/modules/dashboard/index.ts`
- Modify: `src/index.ts` (or equivalent mount point)

- [ ] **Step 1: Create Dashboard Router**

Create `src/modules/dashboard/index.ts`:
```typescript
import { DashboardService } from "./service";
import { DashboardModel } from "./model";
import { DashboardParamSchema } from "./schema";
import { successResponse } from "@/libs/response";
import { createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";

const FEATURE = "lecturer_dashboard";

export const dashboard = createProtectedApp()
  .group("/api/lecturer/groups/:groupId/dashboard", (app) =>
    app
      .get(
        "/summary",
        async ({ params: { groupId }, set, log, locale }) => {
          const data = await DashboardService.getSummary(groupId, log);
          return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
        },
        {
          params: DashboardParamSchema,
          response: { 200: DashboardModel.summary, 500: DashboardModel.error },
          beforeHandle: hasPermission(FEATURE, "read"),
        }
      )
      .get(
        "/content-health",
        async ({ params: { groupId }, set, log, locale }) => {
          const data = await DashboardService.getContentHealth(groupId, log);
          return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
        },
        {
          params: DashboardParamSchema,
          response: { 200: DashboardModel.contentHealth, 500: DashboardModel.error },
          beforeHandle: hasPermission(FEATURE, "read"),
        }
      )
  );
```

- [ ] **Step 2: Mount router in main app**
We will assume the main app is `src/server.ts` or `src/index.ts`. Since the exact layout isn't known, this is just demonstrating how to mount it.
Modify your main route file to import and `.use()` the new dashboard module.

```typescript
// Example:
// import { dashboard } from "./modules/dashboard";
// app.use(dashboard);
```

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat: implement lecturer dashboard schema and base endpoints"
```
