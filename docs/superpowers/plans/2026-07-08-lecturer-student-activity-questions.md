# Lecturer Student Activity Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detailed question-by-question breakdowns (`questions` array containing prompt, student answer, correct answer, and points) inside every item of `quiz_attempts_history` on the `GET /api/lecturer/groups/:groupId/students/:studentId/activity` endpoint.

**Architecture:** Update the TypeBox response schema (`LecturerGroupsModel.studentActivityDetailResponse`) with the exact `StudentQuizAttemptQuestionItem` structure. Update `LecturerGroupsService.getStudentActivityDetail` to eagerly load `questions` and `answers` from Prisma when fetching `quizAttempts`, mapping each question to the student's corresponding answer with exact point calculations in memory (<200ms target).

**Tech Stack:** Bun, Elysia, TypeBox, Prisma, Zod, TypeScript.

---

### Task 1: Update TypeBox Model & Service Logic

**Files:**
- Modify: `src/modules/lecturer/groups/model.ts`
- Modify: `src/modules/lecturer/groups/service.ts`

- [ ] **Step 1: Update `src/modules/lecturer/groups/model.ts` to include optional `questions` in `quiz_attempts_history`**

Replace the `studentActivityDetailResponse` definition inside `src/modules/lecturer/groups/model.ts`:

```typescript
  studentActivityDetailResponse: t.Object({
    error: t.Boolean(),
    code: t.Number(),
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
          questions: t.Optional(
            t.Array(
              t.Object({
                question_id: t.String(),
                question_text: t.String(),
                question_type: t.Union([t.String(), t.Null()]),
                student_answer: t.Union([t.String(), t.Null()]),
                correct_answer: t.Union([t.String(), t.Null()]),
                is_correct: t.Boolean(),
                points_earned: t.Number(),
                points_possible: t.Number(),
                explanation: t.Union([t.String(), t.Null()]),
              }),
            ),
          ),
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
```

- [ ] **Step 2: Update `getStudentActivityDetail` in `src/modules/lecturer/groups/service.ts`**

Replace the `quizAttempts` query and mapping inside `getStudentActivityDetail` (`src/modules/lecturer/groups/service.ts` around line 380):

```typescript
    const [quizAttempts, materialReads] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: {
          studentId,
          quiz: { groupId },
        },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              passThreshold: true,
              questions: {
                orderBy: { questionOrder: "asc" },
              },
            },
          },
          answers: true,
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

      const questions = attempt.quiz.questions.map((q) => {
        const ans = attempt.answers.find((a) => a.quizQuestionId === q.id);
        const isCorrect = ans?.isCorrect ?? false;
        return {
          question_id: String(q.id),
          question_text: q.questionText,
          question_type: "SHORT_ANSWER",
          student_answer: ans?.answerText ?? null,
          correct_answer: q.answerText ?? null,
          is_correct: isCorrect,
          points_earned: isCorrect ? q.maxScore : 0,
          points_possible: q.maxScore,
          explanation: null,
        };
      });

      return {
        attempt_id: String(attempt.id),
        quiz_id: String(attempt.quizId),
        quiz_title: attempt.quiz.title,
        attempt_number: attempt.attemptNumber,
        score: attempt.score ?? null,
        status,
        started_at: attempt.startedAt.toISOString(),
        submitted_at: attempt.submittedAt
          ? attempt.submittedAt.toISOString()
          : null,
        time_spent_seconds: timeSpentSeconds,
        questions,
      };
    });
```

- [ ] **Step 3: Run linter on modified files to verify syntax and formatting**

Run: `bun run lint`
Expected: PASS with no errors or warnings on `model.ts` and `service.ts`.

---

### Task 2: Update & Expand Integration Tests

**Files:**
- Modify: `src/__tests__/lecturer/groups-students-activity.test.ts`

- [ ] **Step 1: Update integration test setup and assertions in `src/__tests__/lecturer/groups-students-activity.test.ts`**

Replace the contents of `src/__tests__/lecturer/groups-students-activity.test.ts`:

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

  it("should return matrix and drill-down details with question breakdowns for student", async () => {
    const role = await createTestRoleWithPermissions("LecturerRole", [
      { featureName: "group_management", action: "read" },
    ]);

    const { authHeaders, user: lecturer } = await createAuthenticatedUser({
      roleId: role.id,
      email: "dosen@test.com",
    });

    const studentRole = await prisma.role.upsert({
      where: { name: "Mahasiswa" },
      update: {},
      create: { name: "Mahasiswa", description: "Student Role" },
    });

    // Create a student user
    const student = await prisma.user.create({
      data: {
        email: "budi@test.com",
        name: "Budi Santoso",
        password: "hash",
        roleId: studentRole.id,
      },
    });

    // Create group, materials, quizzes, questions
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
          ],
        },
        quizzes: {
          create: [
            {
              title: "Quiz 1",
              levelNumber: 1,
              passThreshold: 70,
              questions: {
                create: [
                  {
                    questionText: "Apa tipe data 3.14?",
                    answerText: "float",
                    maxScore: 100,
                    questionOrder: 1,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        materials: true,
        quizzes: {
          include: { questions: true },
        },
      },
    });

    const mat1 = group.materials[0];
    const quiz1 = group.quizzes[0];
    const question1 = quiz1.questions[0];

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

    // Create QuizAttempt for quiz1 along with QuizAnswer
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz1.id,
        studentId: student.id,
        attemptNumber: 1,
        score: 100,
        startedAt: new Date(Date.now() - 10000),
        submittedAt: new Date(),
        answers: {
          create: [
            {
              quizQuestionId: question1.id,
              answerText: "float",
              isCorrect: true,
            },
          ],
        },
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
    expect(matrixBody.error).toBe(false);
    expect(matrixBody.data.summary.total_students).toBe(1);
    expect(matrixBody.data.students[0].student_id).toBe(student.id);

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
    expect(detailBody.error).toBe(false);
    expect(detailBody.data.student.student_id).toBe(student.id);
    expect(detailBody.data.quiz_attempts_history).toHaveLength(1);
    
    const attemptHistory = detailBody.data.quiz_attempts_history[0];
    expect(attemptHistory.score).toBe(100);
    expect(attemptHistory.questions).toBeDefined();
    expect(attemptHistory.questions).toHaveLength(1);

    const qItem = attemptHistory.questions[0];
    expect(qItem.question_id).toBe(String(question1.id));
    expect(qItem.question_text).toBe("Apa tipe data 3.14?");
    expect(qItem.question_type).toBe("SHORT_ANSWER");
    expect(qItem.student_answer).toBe("float");
    expect(qItem.correct_answer).toBe("float");
    expect(qItem.is_correct).toBe(true);
    expect(qItem.points_earned).toBe(100);
    expect(qItem.points_possible).toBe(100);
    expect(qItem.explanation).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun test src/__tests__/lecturer/groups-students-activity.test.ts`
Expected: PASS (`1 pass`)

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer): include question details inside student activity history"
```
