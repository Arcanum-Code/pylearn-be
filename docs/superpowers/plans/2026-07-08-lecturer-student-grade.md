# Lecturer Student Grade & Activity Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Class Roster & Progress Matrix endpoint (`GET /api/lecturer/groups/:groupId/students-activity`) and the Granular Student Activity Drawer drill-down endpoint (`GET /api/lecturer/groups/:groupId/students/:studentId/activity`) inside the `lecturer/groups` module.

**Architecture:** We will create a new feature module directory at `src/modules/lecturer/groups/` conforming to our 6-part module structure (`error.ts`, `schema.ts`, `model.ts`, `service.ts`, `index.ts`, `locales/`). The service will fetch group enrollments along with material reads and quiz attempts using optimized queries, calculate class summaries, determine per-student progress/status (`AT_RISK`, `INACTIVE`, `ON_TRACK`) with exact status reasons in Bahasa Indonesia, and support optional server-side filtering and sorting. Finally, we will mount the module inside `src/modules/lecturer/index.ts`.

**Tech Stack:** Bun, Elysia, Prisma, Zod, TypeBox, Pino

---

### Task 1: Create Module Errors & Validation Schemas

**Files:**
- Create: `src/modules/lecturer/groups/error.ts`
- Create: `src/modules/lecturer/groups/schema.ts`

- [ ] **Step 1: Write `src/modules/lecturer/groups/error.ts`**

Create `src/modules/lecturer/groups/error.ts` to handle custom errors when a group or student enrollment is not found.

```typescript
import { t } from "@/libs/i18n";

export class LecturerGroupsError extends Error {
  readonly key: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    status: number,
    messageKey: string,
    details?: unknown,
    locale = "en",
  ) {
    super(t(locale, messageKey));
    this.name = "LecturerGroupsError";
    this.key = messageKey;
    this.status = status;
    this.details = details;
  }
}
```

- [ ] **Step 2: Write `src/modules/lecturer/groups/schema.ts`**

Create `src/modules/lecturer/groups/schema.ts` defining Zod validation for query parameters (`status`, `search`, `sortBy`, `sortOrder`).

```typescript
import { z } from "zod";

export const StudentsActivityQuerySchema = z.object({
  status: z
    .enum(["ALL", "AT_RISK", "INACTIVE", "ON_TRACK"])
    .optional()
    .default("ALL"),
  search: z.string().optional(),
  sortBy: z
    .enum(["name", "progress", "quiz_score", "last_active"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type StudentsActivityQuery = z.infer<typeof StudentsActivityQuerySchema>;
```

---

### Task 2: Create OpenAPI TypeBox Models

**Files:**
- Create: `src/modules/lecturer/groups/model.ts`

- [ ] **Step 1: Write `src/modules/lecturer/groups/model.ts`**

Create `src/modules/lecturer/groups/model.ts` with explicit TypeBox schemas matching the expected JSON payloads for Swagger/OpenAPI documentation.

```typescript
import { t } from "elysia";

export const LecturerGroupsModel = {
  studentsActivityQuery: t.Object({
    status: t.Optional(
      t.Union([
        t.Literal("ALL"),
        t.Literal("AT_RISK"),
        t.Literal("INACTIVE"),
        t.Literal("ON_TRACK"),
      ]),
    ),
    search: t.Optional(t.String()),
    sortBy: t.Optional(
      t.Union([
        t.Literal("name"),
        t.Literal("progress"),
        t.Literal("quiz_score"),
        t.Literal("last_active"),
      ]),
    ),
    sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  }),

  studentsActivityResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    data: t.Object({
      summary: t.Object({
        total_students: t.Number(),
        at_risk_count: t.Number(),
        inactive_count: t.Number(),
        on_track_count: t.Number(),
        avg_class_progress: t.Number(),
        avg_class_quiz_score: t.Number(),
      }),
      columns: t.Object({
        materials: t.Array(
          t.Object({
            id: t.String(),
            title: t.String(),
            order: t.Number(),
          }),
        ),
        quizzes: t.Array(
          t.Object({
            id: t.String(),
            title: t.String(),
            level_number: t.Number(),
          }),
        ),
      }),
      students: t.Array(
        t.Object({
          student_id: t.String(),
          name: t.String(),
          email: t.String(),
          avatar_url: t.Union([t.String(), t.Null()]),
          status: t.String(),
          status_reasons: t.Array(t.String()),
          overall_progress_percentage: t.Number(),
          avg_quiz_score: t.Number(),
          last_active_at: t.Union([t.String(), t.Null()]),
          materials_progress: t.Array(
            t.Object({
              material_id: t.String(),
              status: t.String(),
              scroll_percentage: t.Number(),
              last_read_at: t.Union([t.String(), t.Null()]),
            }),
          ),
          quizzes_progress: t.Array(
            t.Object({
              quiz_id: t.String(),
              status: t.String(),
              best_score: t.Union([t.Number(), t.Null()]),
              attempts_count: t.Number(),
              last_attempt_at: t.Union([t.String(), t.Null()]),
            }),
          ),
        }),
      ),
    }),
  }),

  studentActivityDetailResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    data: t.Object({
      student: t.Object({
        student_id: t.String(),
        name: t.String(),
        email: t.String(),
        enrolled_at: t.String(),
      }),
      quiz_attempts_history: t.Array(
        t.Object({
          attempt_id: t.String(),
          quiz_id: t.String(),
          quiz_title: t.String(),
          attempt_number: t.Number(),
          score: t.Union([t.Number(), t.Null()]),
          status: t.String(),
          started_at: t.String(),
          submitted_at: t.Union([t.String(), t.Null()]),
          time_spent_seconds: t.Union([t.Number(), t.Null()]),
        }),
      ),
      material_reading_timeline: t.Array(
        t.Object({
          material_id: t.String(),
          material_title: t.String(),
          status: t.String(),
          scroll_percentage: t.Number(),
          first_opened_at: t.String(),
          completed_at: t.Union([t.String(), t.Null()]),
        }),
      ),
    }),
  }),
};
```

---

### Task 3: Implement Service Layer Logic (Students Matrix & Activity Detail)

**Files:**
- Create: `src/modules/lecturer/groups/service.ts`

- [ ] **Step 1: Write `src/modules/lecturer/groups/service.ts`**

Create `src/modules/lecturer/groups/service.ts` containing the core business logic, aggregation queries, and status calculations.

```typescript
import { prisma } from "@/libs/prisma";
import { Logger } from "pino";
import { LecturerGroupsError } from "./error";
import { StudentsActivityQuery } from "./schema";

export class LecturerGroupsService {
  static async getStudentsActivity(
    groupId: string,
    query: StudentsActivityQuery,
    log: Logger,
  ) {
    log.info({ groupId, query }, "Fetching students activity matrix for group");

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        materials: {
          select: { id: true, title: true, sequence: true },
          orderBy: { sequence: "asc" },
        },
        quizzes: {
          select: { id: true, title: true, levelNumber: true, passThreshold: true },
          orderBy: { levelNumber: "asc" },
        },
        enrollments: {
          select: {
            createdAt: true,
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                MaterialRead: {
                  where: { material: { groupId } },
                  select: {
                    materialId: true,
                    scrollPercentage: true,
                    readAt: true,
                    updatedAt: true,
                  },
                },
                QuizAttempt: {
                  where: { quiz: { groupId } },
                  select: {
                    id: true,
                    quizId: true,
                    score: true,
                    attemptNumber: true,
                    startedAt: true,
                    submittedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new LecturerGroupsError(404, "common.notFound");
    }

    const totalMaterials = group.materials.length;
    const totalQuizzes = group.quizzes.length;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Preliminary calculation for class averages
    let totalProgressSum = 0;
    let totalQuizScoreSum = 0;

    const rawStudents = group.enrollments.map((enrollment) => {
      const student = enrollment.student;

      // Materials progress
      let completedMaterialsCount = 0;
      const materialsProgress = group.materials.map((mat) => {
        const read = student.MaterialRead.find(
          (r) => r.materialId === mat.id,
        );
        const scrollPercentage = read?.scrollPercentage ?? 0;
        const isCompleted = scrollPercentage === 100 || read?.readAt != null;
        if (isCompleted) {
          completedMaterialsCount++;
        }

        let status = "not_started";
        if (isCompleted) {
          status = "completed";
        } else if (scrollPercentage > 0) {
          status = "in_progress";
        }

        return {
          material_id: String(mat.id),
          status,
          scroll_percentage: scrollPercentage,
          last_read_at: read?.readAt ? read.readAt.toISOString() : null,
        };
      });

      const overallProgressPercentage =
        totalMaterials > 0
          ? Math.round((completedMaterialsCount / totalMaterials) * 100 * 10) / 10
          : 0;

      // Quizzes progress
      let attemptedQuizzesCount = 0;
      let quizScoreSum = 0;

      const quizzesProgress = group.quizzes.map((q) => {
        const attempts = student.QuizAttempt.filter(
          (a) => a.quizId === q.id,
        );
        const attemptsCount = attempts.length;

        let bestScore: number | null = null;
        let lastAttemptAt: string | null = null;
        let status = "not_attempted";

        if (attemptsCount > 0) {
          attemptedQuizzesCount++;
          const scores = attempts
            .map((a) => a.score)
            .filter((s): s is number => s != null);
          bestScore = scores.length > 0 ? Math.max(...scores) : null;

          if (bestScore != null) {
            quizScoreSum += bestScore;
            status = bestScore >= q.passThreshold ? "passed" : "failed";
          } else {
            status = "failed";
          }

          const timestamps = attempts.map(
            (a) => (a.submittedAt || a.startedAt).getTime(),
          );
          const latestTs = Math.max(...timestamps);
          lastAttemptAt = new Date(latestTs).toISOString();
        }

        return {
          quiz_id: String(q.id),
          status,
          best_score: bestScore,
          attempts_count: attemptsCount,
          last_attempt_at: lastAttemptAt,
        };
      });

      const avgQuizScore =
        attemptedQuizzesCount > 0
          ? Math.round((quizScoreSum / attemptedQuizzesCount) * 10) / 10
          : 0;

      // Last active calculation
      const activeTimestamps: number[] = [];
      student.MaterialRead.forEach((r) => {
        if (r.readAt) activeTimestamps.push(r.readAt.getTime());
        if (r.updatedAt) activeTimestamps.push(r.updatedAt.getTime());
      });
      student.QuizAttempt.forEach((a) => {
        if (a.startedAt) activeTimestamps.push(a.startedAt.getTime());
        if (a.submittedAt) activeTimestamps.push(a.submittedAt.getTime());
      });

      const lastActiveAt =
        activeTimestamps.length > 0
          ? new Date(Math.max(...activeTimestamps)).toISOString()
          : null;

      totalProgressSum += overallProgressPercentage;
      totalQuizScoreSum += avgQuizScore;

      return {
        student_id: student.id,
        name: student.name || "",
        email: student.email,
        avatar_url: null,
        overall_progress_percentage: overallProgressPercentage,
        avg_quiz_score: avgQuizScore,
        last_active_at: lastActiveAt,
        materials_progress: materialsProgress,
        quizzes_progress: quizzesProgress,
      };
    });

    const totalStudents = rawStudents.length;
    const avgClassProgress =
      totalStudents > 0
        ? Math.round((totalProgressSum / totalStudents) * 10) / 10
        : 0;
    const avgClassQuizScore =
      totalStudents > 0
        ? Math.round((totalQuizScoreSum / totalStudents) * 10) / 10
        : 0;

    let atRiskCount = 0;
    let inactiveCount = 0;
    let onTrackCount = 0;

    const studentsWithStatus = rawStudents.map((student) => {
      const statusReasons: string[] = [];
      let isAtRisk = false;

      // Check AT_RISK conditions
      if (student.avg_quiz_score < 60 && student.quizzes_progress.some((q) => q.attempts_count > 0)) {
        isAtRisk = true;
        statusReasons.push(`Rata-rata nilai kuis di bawah 60 (${student.avg_quiz_score})`);
      }

      student.quizzes_progress.forEach((qp) => {
        const quizObj = group.quizzes.find((q) => String(q.id) === qp.quiz_id);
        if (qp.attempts_count >= 3 && qp.status !== "passed") {
          isAtRisk = true;
          statusReasons.push(
            `Mengulang ${quizObj?.title || "kuis"} sebanyak ${qp.attempts_count} kali`,
          );
        } else if (qp.attempts_count > 0 && qp.best_score != null && quizObj && qp.best_score < quizObj.passThreshold) {
          statusReasons.push(
            `Nilai ${quizObj.title} di bawah batas kelulusan (${qp.best_score}/${quizObj.passThreshold})`,
          );
        }
      });

      let status = "ON_TRACK";
      if (isAtRisk) {
        status = "AT_RISK";
        atRiskCount++;
      } else {
        // Check INACTIVE
        const lastActiveDate = student.last_active_at
          ? new Date(student.last_active_at)
          : null;
        const isOlderThan7Days =
          !lastActiveDate || lastActiveDate < sevenDaysAgo;
        const isLowProgress =
          student.overall_progress_percentage < 20 && avgClassProgress > 50;

        if (isOlderThan7Days || isLowProgress) {
          status = "INACTIVE";
          inactiveCount++;
          if (isOlderThan7Days) {
            statusReasons.push("Belum aktif selama 7 hari terakhir");
          }
          if (isLowProgress) {
            statusReasons.push(
              `Progres keseluruhan di bawah 20% (${student.overall_progress_percentage}%) sedangkan rata-rata kelas ${avgClassProgress}%`,
            );
          }
        } else {
          status = "ON_TRACK";
          onTrackCount++;
          if (statusReasons.length === 0) {
            statusReasons.push("Progres dan nilai kuis dalam kondisi baik");
          }
        }
      }

      return {
        ...student,
        status,
        status_reasons: statusReasons,
      };
    });

    // Filtering & Sorting
    let filteredStudents = studentsWithStatus;
    if (query.status && query.status !== "ALL") {
      filteredStudents = filteredStudents.filter(
        (s) => s.status === query.status,
      );
    }
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredStudents = filteredStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.email.toLowerCase().includes(searchLower),
      );
    }

    if (query.sortBy) {
      const orderMultiplier = query.sortOrder === "desc" ? -1 : 1;
      filteredStudents.sort((a, b) => {
        if (query.sortBy === "name") {
          return orderMultiplier * a.name.localeCompare(b.name);
        } else if (query.sortBy === "progress") {
          return (
            orderMultiplier *
            (a.overall_progress_percentage - b.overall_progress_percentage)
          );
        } else if (query.sortBy === "quiz_score") {
          return orderMultiplier * (a.avg_quiz_score - b.avg_quiz_score);
        } else if (query.sortBy === "last_active") {
          const timeA = a.last_active_at
            ? new Date(a.last_active_at).getTime()
            : 0;
          const timeB = b.last_active_at
            ? new Date(b.last_active_at).getTime()
            : 0;
          return orderMultiplier * (timeA - timeB);
        }
        return 0;
      });
    }

    return {
      summary: {
        total_students: totalStudents,
        at_risk_count: atRiskCount,
        inactive_count: inactiveCount,
        on_track_count: onTrackCount,
        avg_class_progress: avgClassProgress,
        avg_class_quiz_score: avgClassQuizScore,
      },
      columns: {
        materials: group.materials.map((m) => ({
          id: String(m.id),
          title: m.title,
          order: m.sequence,
        })),
        quizzes: group.quizzes.map((q) => ({
          id: String(q.id),
          title: q.title,
          level_number: q.levelNumber,
        })),
      },
      students: filteredStudents,
    };
  }

  static async getStudentActivityDetail(
    groupId: string,
    studentId: string,
    log: Logger,
  ) {
    log.info(
      { groupId, studentId },
      "Fetching granular student activity detail",
    );

    const enrollment = await prisma.groupEnrollment.findUnique({
      where: {
        groupId_studentId: { groupId, studentId },
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!enrollment) {
      throw new LecturerGroupsError(404, "common.notFound");
    }

    const [quizAttempts, materialReads] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: {
          studentId,
          quiz: { groupId },
        },
        include: {
          quiz: { select: { id: true, title: true, passThreshold: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.materialRead.findMany({
        where: {
          studentId,
          material: { groupId },
        },
        include: {
          material: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const quizAttemptsHistory = quizAttempts.map((attempt) => {
      let status = "in_progress";
      if (attempt.score != null && attempt.submittedAt != null) {
        status =
          attempt.score >= attempt.quiz.passThreshold ? "passed" : "failed";
      }

      let timeSpentSeconds: number | null = null;
      if (attempt.submittedAt && attempt.startedAt) {
        timeSpentSeconds = Math.round(
          (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
        );
      }

      return {
        attempt_id: String(attempt.id),
        quiz_id: String(attempt.quizId),
        quiz_title: attempt.quiz.title,
        attempt_number: attempt.attemptNumber,
        score: attempt.score ?? null,
        status,
        started_at: attempt.startedAt.toISOString(),
        submitted_at: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
        time_spent_seconds: timeSpentSeconds,
      };
    });

    const materialReadingTimeline = materialReads.map((read) => {
      const scrollPercentage = read.scrollPercentage ?? 0;
      let status = "not_started";
      if (scrollPercentage === 100 || read.readAt != null) {
        status = "completed";
      } else if (scrollPercentage > 0) {
        status = "in_progress";
      }

      return {
        material_id: String(read.materialId),
        material_title: read.material.title,
        status,
        scroll_percentage: scrollPercentage,
        first_opened_at: read.createdAt.toISOString(),
        completed_at: read.readAt ? read.readAt.toISOString() : null,
      };
    });

    return {
      student: {
        student_id: enrollment.student.id,
        name: enrollment.student.name || "",
        email: enrollment.student.email,
        enrolled_at: enrollment.createdAt.toISOString(),
      },
      quiz_attempts_history: quizAttemptsHistory,
      material_reading_timeline: materialReadingTimeline,
    };
  }
}
```

---

### Task 4: Implement Route Handlers & Mount to Lecturer Module

**Files:**
- Create: `src/modules/lecturer/groups/index.ts`
- Modify: `src/modules/lecturer/index.ts`

- [ ] **Step 1: Write `src/modules/lecturer/groups/index.ts`**

Create `src/modules/lecturer/groups/index.ts` declaring our protected routes and mounting beforeHandle permission checking.

```typescript
import { createProtectedApp } from "@/libs/base";
import { successResponse, errorResponse } from "@/libs/response";
import { hasPermission } from "@/middleware/permission";
import { LecturerGroupsService } from "./service";
import { StudentsActivityQuerySchema } from "./schema";
import { LecturerGroupsModel } from "./model";
import { LecturerGroupsError } from "./error";

const FEATURE_NAME = "group_management";

export const lecturerGroups = createProtectedApp({ tags: ["Lecturer Groups"] })
  .get(
    "/groups/:groupId/students-activity",
    async ({ set, params, query, log, locale }) => {
      const result = await LecturerGroupsService.getStudentsActivity(
        params.groupId,
        query,
        log,
      );
      return successResponse(
        set,
        result,
        { key: "common.success" },
        200,
        undefined,
        locale,
      );
    },
    {
      query: StudentsActivityQuerySchema,
      response: { 200: LecturerGroupsModel.studentsActivityResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/groups/:groupId/students/:studentId/activity",
    async ({ set, params, log, locale }) => {
      const result = await LecturerGroupsService.getStudentActivityDetail(
        params.groupId,
        params.studentId,
        log,
      );
      return successResponse(
        set,
        result,
        { key: "common.success" },
        200,
        undefined,
        locale,
      );
    },
    {
      response: { 200: LecturerGroupsModel.studentActivityDetailResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .onError(({ error, set, locale }) => {
    if (error instanceof LecturerGroupsError) {
      return errorResponse(
        set,
        error.status,
        { key: error.key },
        error.details,
        locale,
      );
    }
  });
```

- [ ] **Step 2: Mount `lecturerGroups` in `src/modules/lecturer/index.ts`**

Update `src/modules/lecturer/index.ts` to wire up the new groups module alongside `lecturerQuiz`.

```typescript
import { createBaseApp } from "@/libs/base";
import { lecturerQuiz } from "./quiz";
import { lecturerGroups } from "./groups";

export const lecturer = createBaseApp({ tags: ["Lecturer"] }).group(
  "/lecturer",
  (app) => app.use(lecturerQuiz).use(lecturerGroups),
);
```

---

### Task 5: Write & Run Integration Tests

**Files:**
- Create: `src/__tests__/lecturer/groups-students-activity.test.ts`

- [ ] **Step 1: Write integration tests `src/__tests__/lecturer/groups-students-activity.test.ts`**

Create `src/__tests__/lecturer/groups-students-activity.test.ts` to test both the matrix endpoint and the drill-down drawer endpoint against the real PostgreSQL database.

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";
import { prisma } from "@/libs/prisma";

describe("Lecturer Groups Students Activity Endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should return matrix and drill-down details for enrolled student", async () => {
    const role = await createTestRoleWithPermissions("LecturerRole", [
      { featureName: "group_management", action: "read" },
    ]);

    const { authHeaders, user: lecturer } = await createAuthenticatedUser({
      roleId: role.id,
      email: "dosen@test.com",
    });

    // Create a student user
    const student = await prisma.user.create({
      data: {
        email: "budi@test.com",
        name: "Budi Santoso",
        password: "hash",
        roleId: role.id,
      },
    });

    // Create group, materials, quizzes, enrollments
    const group = await prisma.group.create({
      data: {
        name: "Python 101",
        materials: {
          create: [
            {
              title: "Mat 1",
              materialType: "markdown",
              sequence: 1,
              lecturerId: lecturer.id,
            },
            {
              title: "Mat 2",
              materialType: "markdown",
              sequence: 2,
              lecturerId: lecturer.id,
            },
          ],
        },
        quizzes: {
          create: [
            {
              title: "Quiz 1",
              levelNumber: 1,
              passThreshold: 70,
            },
          ],
        },
        enrollments: {
          create: {
            studentId: student.id,
          },
        },
      },
      include: {
        materials: true,
        quizzes: true,
      },
    });

    const mat1 = group.materials[0];
    const quiz1 = group.quizzes[0];

    // Create MaterialRead for mat1
    await prisma.materialRead.create({
      data: {
        materialId: mat1.id,
        studentId: student.id,
        materialVersion: 1,
        scrollPercentage: 100,
        readAt: new Date(),
      },
    });

    // Create QuizAttempt for quiz1
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz1.id,
        studentId: student.id,
        attemptNumber: 1,
        score: 95,
        startedAt: new Date(Date.now() - 10000),
        submittedAt: new Date(),
      },
    });

    // 1. Test GET /lecturer/groups/:groupId/students-activity
    const matrixRes = await app.handle(
      new Request(
        `http://localhost/lecturer/groups/${group.id}/students-activity`,
        {
          headers: authHeaders,
        },
      ),
    );

    expect(matrixRes.status).toBe(200);
    const matrixBody = await matrixRes.json();
    expect(matrixBody.success).toBe(true);
    expect(matrixBody.data.summary.total_students).toBe(1);
    expect(matrixBody.data.students[0].student_id).toBe(student.id);
    expect(matrixBody.data.students[0].overall_progress_percentage).toBe(50.0);
    expect(matrixBody.data.students[0].avg_quiz_score).toBe(95.0);
    expect(matrixBody.data.students[0].status).toBe("ON_TRACK");

    // 2. Test GET /lecturer/groups/:groupId/students/:studentId/activity
    const detailRes = await app.handle(
      new Request(
        `http://localhost/lecturer/groups/${group.id}/students/${student.id}/activity`,
        {
          headers: authHeaders,
        },
      ),
    );

    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.success).toBe(true);
    expect(detailBody.data.student.student_id).toBe(student.id);
    expect(detailBody.data.quiz_attempts_history).toHaveLength(1);
    expect(detailBody.data.quiz_attempts_history[0].score).toBe(95);
    expect(detailBody.data.material_reading_timeline).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to make sure it passes**

Run: `bun test src/__tests__/lecturer/groups-students-activity.test.ts`
Expected: PASS

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer): implement students activity matrix and detail drill-down endpoints"
```
