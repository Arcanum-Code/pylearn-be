# Student Group Materials & Timeline Quiz Pass Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `GET /groups/:groupId/materials` and `GET /groups/mahasiswa/:groupId` (`StudentGroupService`) to return `passThreshold` (`pass_threshold`) and `isPassed` (`is_passed`) for quizzes so that the frontend can display quiz results and enforce level progression thresholds.

**Architecture:** 
In `StudentGroupService.getGroupMaterials` (`GET /groups/:groupId/materials`), extend the Prisma query on `Group` to include published `quizzes` along with `QuizAttempt` records for the requesting `studentId`. Calculate `best_score` and `is_passed` (`best_score !== null ? best_score >= quiz.passThreshold : null`), and return a `quizzes` array (snake_case format) alongside `materials`. 
In `StudentGroupService.getStudentGroupDetail` (`GET /groups/mahasiswa/:groupId`), update `quizItems` mapping to include `passThreshold` and `isPassed` (camelCase format matching existing `QuizItemTimelineSchema`). Update TypeBox models in `model.ts` (`StudentMaterialListSchema` and `QuizItemTimelineSchema`) and document `quizzes` under Section 1 of `docs/frontend/student-material-api.md`.

**Tech Stack:** Bun, Elysia, TypeBox (`zod`), Prisma, PostgreSQL.

---

## File Structure & Decomposition

- **`src/modules/student/groups/model.ts`**:
  - Add `StudentGroupQuizItemSchema` with snake_case fields (`quiz_id`, `title`, `level_number`, `status`, `pass_threshold`, `is_passed`, `best_score`, `deadline`) and attach it to `StudentMaterialListSchema.quizzes`.
  - Add `passThreshold: z.number()` and `isPassed: z.boolean().nullable()` to `QuizItemTimelineSchema` (used in `StudentGroupDetailSchema.items`).
- **`src/modules/student/groups/service.ts`**:
  - In `getGroupMaterials`, add `quizzes` to `prisma.group.findUnique` include clause (filtering `isPublished: true`, ordered by `levelNumber: "asc"`, including `QuizAttempt` for `studentId`). Map `group.quizzes` to snake_case format (`pass_threshold: quiz.passThreshold`, `is_passed: bestScore !== null ? bestScore >= quiz.passThreshold : null`) and return `quizzes` alongside `materials`.
  - In `getStudentGroupDetail`, update `quizItems` map to include `passThreshold: quiz.passThreshold` and `isPassed: bestScore !== null ? bestScore >= quiz.passThreshold : null`.
- **`src/__tests__/student/material-list.test.ts`**:
  - Update existing test and add a new test case checking that `GET /student/groups/:groupId/materials` includes `quizzes` with correct `pass_threshold` and `is_passed` calculations (`null` when unsubmitted, `true`/`false` after attempts).
- **`src/__tests__/student/group-detail.test.ts`**:
  - Create integration tests for `GET /student/groups/mahasiswa/:groupId` verifying the timeline items contain `passThreshold` and `isPassed` for quiz items.
- **`docs/frontend/student-material-api.md`**:
  - Update Section 1 response schema to document the `quizzes` array alongside `materials`.

---

## Task 1: Update TypeBox/Zod Schemas (`model.ts`)

**Files:**
- Modify: `src/modules/student/groups/model.ts` (diff)

- [ ] **Step 1: Update `model.ts` with `StudentGroupQuizItemSchema` and `QuizItemTimelineSchema` fields**

In `src/modules/student/groups/model.ts`, find this exact block:

```typescript
export const StudentMaterialItemSchema = z.object({
  material_id: z.string(),
  title: z.string(),
  sequence_order: z.number().int(),
  status: z.string(),
  completed_at: z.string().nullable(),
});

export const StudentMaterialListSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  materials: z.array(StudentMaterialItemSchema),
  progress: z.object({
    completed: z.number().int(),
    total: z.number().int(),
  }),
});

const MaterialItemTimelineSchema = z.object({
```

Replace it with:

```typescript
export const StudentMaterialItemSchema = z.object({
  material_id: z.string(),
  title: z.string(),
  sequence_order: z.number().int(),
  status: z.string(),
  completed_at: z.string().nullable(),
});

export const StudentGroupQuizItemSchema = z.object({
  quiz_id: z.string(),
  title: z.string(),
  level_number: z.number().int(),
  status: z.string(),
  pass_threshold: z.number(),
  is_passed: z.boolean().nullable(),
  best_score: z.number().nullable(),
  deadline: z.string().datetime().nullable(),
});

export const StudentMaterialListSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  materials: z.array(StudentMaterialItemSchema),
  quizzes: z.array(StudentGroupQuizItemSchema),
  progress: z.object({
    completed: z.number().int(),
    total: z.number().int(),
  }),
});

const MaterialItemTimelineSchema = z.object({
```

And in `src/modules/student/groups/model.ts`, find this exact block:

```typescript
const QuizItemTimelineSchema = z.object({
  type: z.literal("quiz"),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  deadline: z.string().datetime().nullable(),
  bestScore: z.number().nullable(),
  order: z.number().int(),
});
```

Replace it with:

```typescript
const QuizItemTimelineSchema = z.object({
  type: z.literal("quiz"),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  deadline: z.string().datetime().nullable(),
  bestScore: z.number().nullable(),
  passThreshold: z.number(),
  isPassed: z.boolean().nullable(),
  order: z.number().int(),
});
```

---

## Task 2: Update `StudentGroupService` Logic (`service.ts`)

**Files:**
- Modify: `src/modules/student/groups/service.ts` (diff)

- [ ] **Step 1: Update `getGroupMaterials` to query quizzes and map `pass_threshold` / `is_passed`**

In `src/modules/student/groups/service.ts`, find this exact block:

```typescript
  static async getGroupMaterials(
    groupId: string,
    studentId: string,
    log: Logger,
  ) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        materials: {
          orderBy: { sequence: "asc" },
          where: { publishedAt: { lte: new Date() } },
          include: {
            reads: {
              where: { studentId },
            },
          },
        },
      },
    });

    const locale = (log.bindings()?.locale as string) || "en";
    if (!group) throw new GroupNotFoundError(locale);

    let completedCount = 0;
    const materials = group.materials.map((mat) => {
      const read = mat.reads[0];
      let status = "not_started";
      let completed_at = null;

      if (read) {
        if (read.readAt) {
          status = "completed";
          completed_at = read.readAt.toISOString();
          completedCount++;
        } else {
          status = "in_progress";
        }
      }

      return {
        material_id: mat.id.toString(),
        title: mat.title,
        sequence_order: mat.sequence,
        status,
        completed_at,
      };
    });

    return {
      group_id: group.id,
      group_name: group.name,
      materials,
      progress: {
        completed: completedCount,
        total: materials.length,
      },
    };
  }
```

Replace it with:

```typescript
  static async getGroupMaterials(
    groupId: string,
    studentId: string,
    log: Logger,
  ) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        materials: {
          orderBy: { sequence: "asc" },
          where: { publishedAt: { lte: new Date() } },
          include: {
            reads: {
              where: { studentId },
            },
          },
        },
        quizzes: {
          where: { isPublished: true },
          orderBy: { levelNumber: "asc" },
          include: {
            QuizAttempt: {
              where: { studentId },
              orderBy: { score: "desc" },
            },
          },
        },
      },
    });

    const locale = (log.bindings()?.locale as string) || "en";
    if (!group) throw new GroupNotFoundError(locale);

    let completedCount = 0;
    const materials = group.materials.map((mat) => {
      const read = mat.reads[0];
      let status = "not_started";
      let completed_at = null;

      if (read) {
        if (read.readAt) {
          status = "completed";
          completed_at = read.readAt.toISOString();
          completedCount++;
        } else {
          status = "in_progress";
        }
      }

      return {
        material_id: mat.id.toString(),
        title: mat.title,
        sequence_order: mat.sequence,
        status,
        completed_at,
      };
    });

    const quizzes = (group.quizzes || []).map((quiz) => {
      const attempts = quiz.QuizAttempt;
      const hasSubmitted = attempts.some((a) => a.submittedAt !== null);
      const hasInProgress = attempts.some((a) => a.submittedAt === null);
      let status = "not_started";

      if (hasSubmitted) {
        status = "completed";
      } else if (hasInProgress) {
        status = "in_progress";
      }

      const submittedAttempts = attempts.filter(
        (a) => a.submittedAt !== null && a.score !== null,
      );
      const bestScore =
        submittedAttempts.length > 0
          ? Math.max(...submittedAttempts.map((a) => a.score!))
          : null;

      const isPassed = bestScore !== null ? bestScore >= quiz.passThreshold : null;

      return {
        quiz_id: quiz.id.toString(),
        title: quiz.title,
        level_number: quiz.levelNumber,
        status,
        pass_threshold: quiz.passThreshold,
        is_passed: isPassed,
        best_score: bestScore,
        deadline: quiz.endTime ? quiz.endTime.toISOString() : null,
      };
    });

    return {
      group_id: group.id,
      group_name: group.name,
      materials,
      quizzes,
      progress: {
        completed: completedCount,
        total: materials.length,
      },
    };
  }
```

- [ ] **Step 2: Update `getStudentGroupDetail` to include `passThreshold` and `isPassed` in `quizItems`**

In `src/modules/student/groups/service.ts`, find this exact block:

```typescript
    const quizItems = group.quizzes.map((quiz) => {
      const attempts = quiz.QuizAttempt;
      const hasSubmitted = attempts.some((a) => a.submittedAt !== null);
      const hasInProgress = attempts.some((a) => a.submittedAt === null);
      let status: "not_started" | "in_progress" | "completed" = "not_started";

      if (hasSubmitted) {
        status = "completed";
      } else if (hasInProgress) {
        status = "in_progress";
      }

      const submittedAttempts = attempts.filter(
        (a) => a.submittedAt !== null && a.score !== null,
      );
      const bestScore =
        submittedAttempts.length > 0
          ? Math.max(...submittedAttempts.map((a) => a.score!))
          : null;

      return {
        type: "quiz" as const,
        id: quiz.id.toString(),
        title: quiz.title,
        description: quiz.description || "",
        status,
        deadline: quiz.endTime ? quiz.endTime.toISOString() : null,
        bestScore,
        order: quiz.levelNumber,
      };
    });
```

Replace it with:

```typescript
    const quizItems = group.quizzes.map((quiz) => {
      const attempts = quiz.QuizAttempt;
      const hasSubmitted = attempts.some((a) => a.submittedAt !== null);
      const hasInProgress = attempts.some((a) => a.submittedAt === null);
      let status: "not_started" | "in_progress" | "completed" = "not_started";

      if (hasSubmitted) {
        status = "completed";
      } else if (hasInProgress) {
        status = "in_progress";
      }

      const submittedAttempts = attempts.filter(
        (a) => a.submittedAt !== null && a.score !== null,
      );
      const bestScore =
        submittedAttempts.length > 0
          ? Math.max(...submittedAttempts.map((a) => a.score!))
          : null;

      const isPassed = bestScore !== null ? bestScore >= quiz.passThreshold : null;

      return {
        type: "quiz" as const,
        id: quiz.id.toString(),
        title: quiz.title,
        description: quiz.description || "",
        status,
        deadline: quiz.endTime ? quiz.endTime.toISOString() : null,
        bestScore,
        passThreshold: quiz.passThreshold,
        isPassed,
        order: quiz.levelNumber,
      };
    });
```

---

## Task 3: Integration Tests (`material-list.test.ts` & `group-detail.test.ts`)

**Files:**
- Modify: `src/__tests__/student/material-list.test.ts` (diff)
- Create: `src/__tests__/student/group-detail.test.ts`

- [ ] **Step 1: Update `src/__tests__/student/material-list.test.ts` to check `quizzes`, `pass_threshold`, and `is_passed`**

In `src/__tests__/student/material-list.test.ts`, find this exact block:

```typescript
    await prisma.material.create({
      data: {
        title: "Mat 2",
        materialType: "file",
        content: "/storage/2.pdf",
        groupId,
        lecturerId: lecturer.id,
        sequence: 2,
        publishedAt: new Date(Date.now() - 100000),
      },
    });
  });

  it("should get group materials with default progress", async () => {
    const res = await app.handle(
      new Request(`http://localhost/student/groups/${groupId}/materials`, {
        headers: authHeaders,
      }),
    );
    const body = await res.json();
    console.log("RESPONSE BODY:", body);
    expect(res.status).toBe(200);
    expect(body.data.group_name).toBe("Test Group");
    expect(body.data.materials.length).toBe(2);
    expect(body.data.materials[0].status).toBe("not_started");
  });
});
```

Replace it with:

```typescript
    await prisma.material.create({
      data: {
        title: "Mat 2",
        materialType: "file",
        content: "/storage/2.pdf",
        groupId,
        lecturerId: lecturer.id,
        sequence: 2,
        publishedAt: new Date(Date.now() - 100000),
      },
    });

    await prisma.quiz.create({
      data: {
        groupId,
        title: "Quiz Level 1",
        description: "Test quiz",
        isPublished: true,
        levelNumber: 1,
        passThreshold: 75.0,
      },
    });
  });

  it("should get group materials with default progress and quizzes", async () => {
    const res = await app.handle(
      new Request(`http://localhost/student/groups/${groupId}/materials`, {
        headers: authHeaders,
      }),
    );
    const body = await res.json();
    console.log("RESPONSE BODY:", body);
    expect(res.status).toBe(200);
    expect(body.data.group_name).toBe("Test Group");
    expect(body.data.materials.length).toBe(2);
    expect(body.data.materials[0].status).toBe("not_started");
    expect(body.data.quizzes.length).toBe(1);
    expect(body.data.quizzes[0].title).toBe("Quiz Level 1");
    expect(body.data.quizzes[0].pass_threshold).toBe(75.0);
    expect(body.data.quizzes[0].is_passed).toBe(null);
    expect(body.data.quizzes[0].best_score).toBe(null);
  });
});
```

- [ ] **Step 2: Run `bun test src/__tests__/student/material-list.test.ts` to verify it passes**

Run: `bun test src/__tests__/student/material-list.test.ts`
Expected: PASS

- [ ] **Step 3: Create `src/__tests__/student/group-detail.test.ts` to verify `GET /groups/mahasiswa/:groupId` timeline API `passThreshold` and `isPassed`**

Create `src/__tests__/student/group-detail.test.ts` with:

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestUser,
} from "../test_utils";

describe("Student Group Detail Timeline API", () => {
  let authHeaders: Record<string, string>;
  let groupId: string;
  let studentId: string;

  beforeEach(async () => {
    await resetDatabase();

    const studentRole = await createTestRoleWithPermissions("student", [
      { featureName: "student_material_access", action: "read" },
    ]);

    const studentUser = await createAuthenticatedUser({
      email: "student@test.com",
      roleId: studentRole.id,
    });
    authHeaders = studentUser.authHeaders;
    studentId = studentUser.user.id;

    const group = await prisma.group.create({ data: { name: "Timeline Cohort" } });
    groupId = group.id;

    const quiz = await prisma.quiz.create({
      data: {
        groupId,
        title: "Timeline Quiz 1",
        description: "First Quiz",
        isPublished: true,
        levelNumber: 1,
        passThreshold: 70.0,
      },
    });

    // Create a submitted quiz attempt that passes threshold (score 80 >= 70)
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId,
        attemptNumber: 1,
        score: 80.0,
        submittedAt: new Date(),
      },
    });
  });

  it("should get student group detail timeline with passThreshold and isPassed true", async () => {
    const res = await app.handle(
      new Request(`http://localhost/student/groups/mahasiswa/${groupId}`, {
        headers: authHeaders,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.groupName).toBe("Timeline Cohort");
    const quizItem = body.data.items.find((item: any) => item.type === "quiz");
    expect(quizItem).toBeDefined();
    expect(quizItem.passThreshold).toBe(70.0);
    expect(quizItem.bestScore).toBe(80.0);
    expect(quizItem.isPassed).toBe(true);
  });
});
```

- [ ] **Step 4: Run `bun test src/__tests__/student/group-detail.test.ts` to verify it passes**

Run: `bun test src/__tests__/student/group-detail.test.ts`
Expected: PASS

---

## Task 4: Update Frontend API Documentation (`student-material-api.md`)

**Files:**
- Modify: `docs/frontend/student-material-api.md` (diff)

- [ ] **Step 1: Document `quizzes` array under `GET /groups/:groupId/materials` response**

In `docs/frontend/student-material-api.md`, find this exact block:

```markdown
### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "group_id": "grp123...",
    "group_name": "Python Basics Cohort 1",
    "materials": [
      {
        "material_id": "1",
        "title": "Introduction to Python",
        "sequence_order": 1,
        "status": "completed",
        "completed_at": "2026-07-04T10:00:00.000Z"
      },
      {
        "material_id": "2",
        "title": "Variables and Data Types",
        "sequence_order": 2,
        "status": "not_started",
        "completed_at": null
      }
    ],
    "progress": {
      "completed": 1,
      "total": 2
    }
  }
}
```
```

Replace it with:

```markdown
### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "group_id": "grp123...",
    "group_name": "Python Basics Cohort 1",
    "materials": [
      {
        "material_id": "1",
        "title": "Introduction to Python",
        "sequence_order": 1,
        "status": "completed",
        "completed_at": "2026-07-04T10:00:00.000Z"
      },
      {
        "material_id": "2",
        "title": "Variables and Data Types",
        "sequence_order": 2,
        "status": "not_started",
        "completed_at": null
      }
    ],
    "quizzes": [
      {
        "quiz_id": "101",
        "title": "Quiz Level 1: Python Syntax",
        "level_number": 1,
        "status": "completed",
        "pass_threshold": 70.0,
        "is_passed": true,
        "best_score": 85.0,
        "deadline": "2026-07-20T23:59:59.000Z"
      },
      {
        "quiz_id": "102",
        "title": "Quiz Level 2: Variables",
        "level_number": 2,
        "status": "not_started",
        "pass_threshold": 75.0,
        "is_passed": null,
        "best_score": null,
        "deadline": null
      }
    ],
    "progress": {
      "completed": 1,
      "total": 2
    }
  }
}
```
```

---

## Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat: add pass_threshold and is_passed fields to student group materials and timeline endpoints"
```
