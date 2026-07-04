# Lecturer Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Lecturer Quiz API (US-L2) allowing lecturers to iteratively create and publish gated, multi-level quizzes with keyword blanks.

**Architecture:** We will create a nested feature module `src/modules/lecturer/quiz` to perfectly mirror the structure of `src/modules/student`. This groups all lecturer-centric operations together. The endpoints will use `createProtectedApp` to enforce JWT authentication and RBAC checks for the `lecturer` role. Data access will be handled via `LecturerQuizService` using Prisma.

**Tech Stack:** Bun, Elysia, Prisma (PostgreSQL), Zod, TypeBox, Pino

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema changes**

```prisma
// Edit prisma/schema.prisma
// 1. Remove the entire model QuizPrerequisite
// 2. Add startIndex and endIndex to QuestionKeyword

model QuestionKeyword {
  id            BigInt       @id @default(autoincrement())
  questionId    BigInt
  question      QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  blankOrder    Int
  correctAnswer String       @db.Text
  startIndex    Int          // Added
  endIndex      Int          // Added
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  quizAnswerItems QuizAnswerItem[]

  @@unique([questionId, blankOrder])
}
```

- [ ] **Step 2: Generate and apply migrations for test db**

```bash
bun run prisma:generate
bunx dotenv -e .env.test -- bunx prisma db push --accept-data-loss
```

### Task 2: Module Scaffolding & Schemas

**Files:**
- Create: `src/modules/lecturer/quiz/error.ts`
- Create: `src/modules/lecturer/quiz/schema.ts`
- Create: `src/modules/lecturer/quiz/model.ts`

- [ ] **Step 1: Define Custom Errors**

```typescript
// src/modules/lecturer/quiz/error.ts
import { AppError } from "@/libs/exceptions";

export class LecturerQuizError extends AppError {
  constructor(code: string, message: string, status = 422, details?: any) {
    super(message, status, code, details);
  }
}
```

- [ ] **Step 2: Define Validation (Zod) Schemas**

```typescript
// src/modules/lecturer/quiz/schema.ts
import { z } from "zod";

export const createQuizSchema = z.object({
  level: z.number().int().min(1),
  title: z.string().min(1),
  pass_threshold: z.number().min(0).max(100).default(70),
});

export const updateQuizSchema = createQuizSchema.partial();
```

- [ ] **Step 3: Define OpenAPI (TypeBox) Models**

```typescript
// src/modules/lecturer/quiz/model.ts
import { t } from "elysia";

export const LecturerQuizModel = {
  createResponse: t.Object({
    quiz_id: t.String(),
    group_id: t.String(),
    level: t.Number(),
    title: t.String(),
    pass_threshold: t.Number(),
    status: t.String(),
    questions: t.Array(t.Any()),
  }),
};
```

### Task 3: Quiz Metadata Endpoints (Create & Update)

**Files:**
- Create: `src/modules/lecturer/quiz/service.ts`
- Create: `src/modules/lecturer/quiz/index.ts`
- Create: `src/__tests__/integration/lecturer-quiz.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write failing test for Create Quiz**

```typescript
// src/__tests__/integration/lecturer-quiz.test.ts
import { describe, expect, it, beforeEach } from 'bun:test';
import { resetDatabase, getAuthToken, createTestUser } from '../test_utils';
import { app } from '../../server';

describe('Lecturer Quiz API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('should create a new quiz draft', async () => {
    const { token } = await getAuthToken({ role: 'lecturer' });
    const req = new Request('http://localhost/api/lecturer/groups/grp_123/quizzes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 1, title: 'Test Quiz', pass_threshold: 80 })
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe('draft');
    expect(body.data.level).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `bun run test:int src/__tests__/integration/lecturer-quiz.test.ts`
Expected: 404 Not Found (route missing)

- [ ] **Step 3: Implement Service and Router**

```typescript
// src/modules/lecturer/quiz/service.ts
import { prisma } from "@/libs/prisma";
import { LecturerQuizError } from "./error";
import { log } from "@/libs/logger"; // Assuming logger exists

export class LecturerQuizService {
  static async createQuiz(groupId: string, data: { level: number, title: string, pass_threshold: number }, userId: string) {
    const existing = await prisma.quiz.findUnique({
      where: { groupId_levelNumber: { groupId, levelNumber: data.level } }
    });

    if (existing) {
      throw new LecturerQuizError("level_exists", `Level ${data.level} already exists in this group`, 422, { quiz_id: existing.id.toString(), title: existing.title });
    }

    const quiz = await prisma.quiz.create({
      data: {
        groupId,
        levelNumber: data.level,
        title: data.title,
        passThreshold: data.pass_threshold,
        isPublished: false,
      }
    });

    log.info({ quizId: quiz.id }, "Lecturer created new quiz draft");

    return {
      quiz_id: `qz_${quiz.id}`,
      group_id: quiz.groupId,
      level: quiz.levelNumber,
      title: quiz.title,
      pass_threshold: quiz.passThreshold,
      status: quiz.isPublished ? "published" : "draft",
      questions: []
    };
  }
}
```

```typescript
// src/modules/lecturer/quiz/index.ts
import { createProtectedApp } from "@/libs/base";
import { LecturerQuizService } from "./service";
import { createQuizSchema } from "./schema";
import { LecturerQuizModel } from "./model";
import { successResponse } from "@/libs/response";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "lecturer_quiz_access";

export const lecturerQuiz = createProtectedApp({ tags: ["Lecturer Quiz"] })
  .post("/api/lecturer/groups/:groupId/quizzes", async ({ set, params, body, user, locale }) => {
    const result = await LecturerQuizService.createQuiz(params.groupId, body, user.id);
    return successResponse(set, result, { key: "quiz.created" }, 201, undefined, locale);
  }, {
    body: createQuizSchema,
    response: { 201: LecturerQuizModel.createResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "create")
  });
```

- [ ] **Step 4: Register Module**
```typescript
// Add to src/server.ts inside the main app definition (or via src/modules/lecturer/index.ts if it exists):
import { lecturerQuiz } from './modules/lecturer/quiz';
app.use(lecturerQuiz);
```

- [ ] **Step 5: Run tests to verify success**
Run: `bun run test:int src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS


### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat(lecturer/quiz): implement schema updates and create quiz endpoint"
```
