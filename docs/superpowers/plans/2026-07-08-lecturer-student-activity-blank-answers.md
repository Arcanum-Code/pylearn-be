# Lecturer Student Activity Fill-In-The-Blanks Answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correctly reconstruct the student's answer (`student_answer`) for fill-in-the-blank questions by fetching blank-level answers from `QuizAnswerItem` and stitching them together using `QuestionKeyword` coordinates.

**Architecture:** 
1. Update the eager-loading query in `LecturerGroupsService.getStudentActivityDetail` to include `keywords` inside `quiz.questions` and `items` inside `answers`.
2. Inside `getStudentActivityDetail`'s question mapping logic:
   - Check if the question is a fill-in-the-blank question (`keywords.length > 0`).
   - If yes, reconstruct the student's answer by finding each blank's `QuizAnswerItem` and slicing it into the correct template coordinates.
   - Otherwise, fall back to `QuizAnswer.answerText`.
3. Update the integration test to simulate a fill-in-the-blank question with `QuestionKeyword` and `QuizAnswerItem` to ensure correct answer reconstruction.

**Tech Stack:** Bun, Elysia, Prisma, TypeScript.

---

### Task 1: Update Service Eager Loading and Answer Reconstruction

**Files:**
- Modify: `src/modules/lecturer/groups/service.ts`

- [ ] **Step 1: Update the Prisma query and mapping logic in `src/modules/lecturer/groups/service.ts`**

Modify the `quizAttempts` query and mapping in `src/modules/lecturer/groups/service.ts` to include `keywords` and `items` and reconstruct fill-in-the-blank answers:

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
                include: {
                  keywords: true,
                },
                orderBy: { questionOrder: "asc" },
              },
            },
          },
          answers: {
            include: {
              items: true,
            },
          },
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

        const isBlankQuestion = q.keywords.length > 0;
        let studentAnswer: string | null = ans?.answerText ?? null;

        if (isBlankQuestion && ans?.items) {
          let result = "";
          let lastIndex = 0;
          const sortedKeywords = [...q.keywords].sort(
            (a, b) => a.startIndex - b.startIndex,
          );
          for (const kw of sortedKeywords) {
            const userItem = ans.items.find((item) => item.keywordId === kw.id);
            const userBlankAnswer = userItem ? userItem.answerText : "";
            result += q.answerText.slice(lastIndex, kw.startIndex);
            result += userBlankAnswer;
            lastIndex = kw.endIndex;
          }
          result += q.answerText.slice(lastIndex);
          studentAnswer = result;
        }

        return {
          question_id: String(q.id),
          question_text: q.questionText,
          question_type: "SHORT_ANSWER",
          student_answer: studentAnswer,
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

- [ ] **Step 2: Run `bun run lint` to verify no warnings or syntax issues**

Run: `bun run lint`
Expected: PASS

---

### Task 2: Update Integration Test to Simulate Fill-In-The-Blanks Question

**Files:**
- Modify: `src/__tests__/lecturer/groups-students-activity.test.ts`

- [ ] **Step 1: Modify integration test database setup and assertions**

Update `src/__tests__/lecturer/groups-students-activity.test.ts` to include a fill-in-the-blank question setup with `QuestionKeyword` and `QuizAnswerItem` to verify that `student_answer` is correctly stitched together:

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

    // Create group, materials, quizzes, fill-in-the-blank questions
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
                    questionText: "Lengkapi kode berikut: ___ = 5",
                    answerText: "x = 5",
                    maxScore: 100,
                    questionOrder: 1,
                    keywords: {
                      create: [
                        {
                          blankOrder: 1,
                          correctAnswer: "x",
                          startIndex: 0,
                          endIndex: 1,
                        },
                      ],
                    },
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
          include: {
            questions: {
              include: { keywords: true },
            },
          },
        },
      },
    });

    const mat1 = group.materials[0];
    const quiz1 = group.quizzes[0];
    const question1 = quiz1.questions[0];
    const keyword1 = question1.keywords[0];

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

    // Create QuizAttempt for quiz1 along with QuizAnswer and QuizAnswerItem (blank answer)
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
              answerText: "",
              isCorrect: true,
              items: {
                create: [
                  {
                    keywordId: keyword1.id,
                    answerText: "x",
                    isCorrect: true,
                  },
                ],
              },
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
    expect(detailBody.data.quiz_attempts_history).toHaveLength(1);
    
    const attemptHistory = detailBody.data.quiz_attempts_history[0];
    expect(attemptHistory.questions).toBeDefined();
    expect(attemptHistory.questions).toHaveLength(1);

    const qItem = attemptHistory.questions[0];
    expect(qItem.question_id).toBe(String(question1.id));
    expect(qItem.question_text).toBe("Lengkapi kode berikut: ___ = 5");
    expect(qItem.question_type).toBe("SHORT_ANSWER");
    expect(qItem.student_answer).toBe("x = 5"); // Successfully reconstructed from QuizAnswerItem!
    expect(qItem.correct_answer).toBe("x = 5");
    expect(qItem.is_correct).toBe(true);
    expect(qItem.points_earned).toBe(100);
  });
});
```

- [ ] **Step 2: Run test suite to verify it passes**

Run: `bun test src/__tests__/lecturer/groups-students-activity.test.ts`
Expected: PASS

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer): reconstruct student_answer for fill-in-the-blank questions"
```
