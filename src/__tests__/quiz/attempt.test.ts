import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";

import {
  resetDatabase,
  createAuthenticatedUser,
  createTestMaterial,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

// =========================================
// Helpers
// =========================================

async function createMockQuizWithLevel(userId: string) {
  const material = await createTestMaterial(userId);

  const quiz = await prisma.quiz.create({
    data: {
      materialId: material.id,
      title: "Attempt Quiz",
      isPublished: true,
    },
  });

  // ✅ Create an underlying level since attempts now target levels directly
  const level = await prisma.quizLevel.create({
    data: {
      quizId: quiz.id,
      title: "Level 1",
      levelOrder: 1,
    },
  });

  return { quiz, level };
}

describe("Quiz Attempt Test Suite", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================
  // POST /quizzes/attempts
  // =========================================
  describe("POST /quizzes/attempts", () => {
    it("should create quiz attempt targeting a quiz level", async () => {
      const role = await createTestRoleWithPermissions("AttemptCreatorRole", [
        {
          featureName: "quiz_management",
          action: "create",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level } = await createMockQuizWithLevel(user.id);

      const res = await app.handle(
        new Request("http://localhost/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizLevelId: level.id.toString(), // ✅ Updated property name
          }),
        }),
      );

      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.quizLevelId).toBe(level.id.toString()); // ✅ Updated property name
      expect(json.data.studentId).toBe(user.id);
    });

    it("should reject duplicate active attempt per level", async () => {
      const role = await createTestRoleWithPermissions("AttemptCreatorRole", [
        {
          featureName: "quiz_management",
          action: "create",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level } = await createMockQuizWithLevel(user.id);

      // Create an initial active open session
      await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
          submittedAt: null,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizLevelId: level.id.toString(),
          }),
        }),
      );

      expect(res.status).toBe(400); // Handled cleanly by custom validation exceptions
    });

    it("should reject without permission", async () => {
      const role = await createTestRoleWithPermissions("AttemptReaderRole", [
        {
          featureName: "quiz_management",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level } = await createMockQuizWithLevel(user.id);

      const res = await app.handle(
        new Request("http://localhost/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizLevelId: level.id.toString(),
          }),
        }),
      );

      expect(res.status).toBe(403);
    });
  });

  // =========================================
  // GET /quizzes/attempts
  // =========================================
  describe("GET /quizzes/attempts", () => {
    it("should return attempts", async () => {
      const role = await createTestRoleWithPermissions("AttemptReaderRole", [
        {
          featureName: "quiz_management",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level } = await createMockQuizWithLevel(user.id);

      await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/attempts?quizLevelId=${level.id}`,
          {
            // ✅ Updated query key
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].quizLevelId).toBe(level.id.toString());
    });
  });

  // =========================================
  // GET /quizzes/attempts/:id
  // =========================================
  describe("GET /quizzes/attempts/:id", () => {
    it("should return attempt detail", async () => {
      const role = await createTestRoleWithPermissions("AttemptReaderRole", [
        {
          featureName: "quiz_management",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level } = await createMockQuizWithLevel(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/attempts/${attempt.id}`, {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(attempt.id.toString());
      expect(json.data.quizLevelId).toBe(level.id.toString());
    });
  });

  // =========================================
  // PATCH /quizzes/attempts/:id/submit
  // =========================================
  describe("PATCH /quizzes/attempts/:id/submit", () => {
    it("should submit attempt", async () => {
      const role = await createTestRoleWithPermissions("AttemptUpdaterRole", [
        {
          featureName: "quiz_management",
          action: "update",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level } = await createMockQuizWithLevel(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/attempts/${attempt.id}/submit`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.submittedAt).not.toBeNull();
    });
  });

  // =========================================
  // GET /quizzes/attempts/status/me
  // =========================================
  describe("GET /quizzes/attempts/status/me", () => {
    it("should return levels with NOT_STARTED status when no answers or attempts exist", async () => {
      const role = await createTestRoleWithPermissions("StatusReaderRole", [
        {
          featureName: "quiz_management",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz, level } = await createMockQuizWithLevel(user.id);

      await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "Sample Question?",
          answerText: "Answer",
          maxScore: 10,
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/attempts/status/me?quizId=${quiz.id}`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.quizId).toBe(quiz.id.toString());
      expect(json.data.levels).toHaveLength(1);
      expect(json.data.levels[0].levelId).toBe(level.id.toString());
      expect(json.data.levels[0].status).toBe("NOT_STARTED");
      expect(json.data.levels[0].currentAttemptId).toBeNull();
      expect(json.data.levels[0].totalQuestions).toBe(1);
    });

    it("should return IN_PROGRESS status when an unsubmitted attempt exists", async () => {
      const role = await createTestRoleWithPermissions("StatusReaderRole", [
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, level } = await createMockQuizWithLevel(user.id);

      // 1. Create a question for this level
      const question = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "What is Bun?",
          answerText: "A fast runtime",
          maxScore: 10,
          questionOrder: 1,
        },
      });

      // 2. Create the open attempt
      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
          submittedAt: null,
        },
      });

      // 3. ✅ SEED THE MOCK ANSWER to mark it as started!
      await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "A fast runtime",
          isCorrect: true,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/attempts/status/me?quizId=${quiz.id}`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.levels[0].status).toBe("IN_PROGRESS");
      expect(json.data.levels[0].currentAttemptId).toBe(attempt.id.toString());
      expect(json.data.attemptHistory).toHaveLength(1);
    });

    it("should return COMPLETED status when a finalized attempt exists", async () => {
      const role = await createTestRoleWithPermissions("StatusReaderRole", [
        {
          featureName: "quiz_management",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz, level } = await createMockQuizWithLevel(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
          submittedAt: new Date(), // Finalized closure state
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/attempts/status/me?quizId=${quiz.id}`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.levels[0].status).toBe("COMPLETED");
      expect(json.data.levels[0].currentAttemptId).toBe(attempt.id.toString());
      expect(json.data.attemptHistory).toHaveLength(1);
    });
  });

  // =========================================
  // GET /quizzes/attempts/:id/results
  // =========================================
  describe("GET /quizzes/attempts/:id/results", () => {
    it("should return detailed evaluation mapping for a submitted attempt", async () => {
      const role = await createTestRoleWithPermissions("ResultReaderRole", [
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, level } = await createMockQuizWithLevel(user.id);

      // Create two questions for the level
      const q1 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "What is Bun?",
          answerText: "A JS runtime",
          maxScore: 50,
          questionOrder: 1,
        },
      });

      const q2 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "Is Prisma an ORM?",
          answerText: "Yes",
          maxScore: 50,
          questionOrder: 2,
        },
      });

      // Create a finalized attempt
      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
          submittedAt: new Date(),
          score: 50, // They got 1 out of 2 right
        },
      });

      // Answer Q1 correctly, but SKIP Q2
      await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: q1.id,
          answerText: "A JS runtime",
          isCorrect: true,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/attempts/${attempt.id}/results`, {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      // Verify overarching data
      expect(json.data.attemptId).toBe(attempt.id.toString());
      expect(json.data.score).toBe(50);
      expect(json.data.details).toHaveLength(2);

      // Verify Question 1 (Answered Correctly)
      const parsedQ1 = json.data.details.find(
        (d: any) => d.questionId === q1.id.toString(),
      );
      expect(parsedQ1.isCorrect).toBe(true);
      expect(parsedQ1.userAnswer).toBe("A JS runtime");

      // Verify Question 2 (Skipped - Handled Gracefully)
      const parsedQ2 = json.data.details.find(
        (d: any) => d.questionId === q2.id.toString(),
      );
      expect(parsedQ2.isCorrect).toBe(false);
      expect(parsedQ2.userAnswer).toBeNull();
      expect(parsedQ2.correctAnswer).toBe("Yes");
    });

    it("should reject 400 if attempt is not yet submitted", async () => {
      const role = await createTestRoleWithPermissions("ResultReaderRole", [
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level } = await createMockQuizWithLevel(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
          submittedAt: null, // Still active
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/attempts/${attempt.id}/results`, {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );

      expect(res.status).toBe(400); // Throws QuizAttemptValidationError
    });
  });

  // =======================================================================
  // GET /quizzes/attempts/results (Bulk Summary / Lecturer View)
  // =======================================================================
  describe("GET /quizzes/attempts/results", () => {
    it("should return high-level summary logs of all quiz attempts for lecturer tracking", async () => {
      const role = await createTestRoleWithPermissions(
        "LecturerResultsReaderRole",
        [{ featureName: "quiz_management", action: "read" }],
      );

      const { user: lecturer, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz, level } = await createMockQuizWithLevel(lecturer.id);

      // Seed 2 questions into the level so totalQuestions count aggregates properly
      await prisma.quizQuestion.createMany({
        data: [
          {
            quizLevelId: level.id,
            questionText: "Q1",
            answerText: "A1",
            questionOrder: 1,
          },
          {
            quizLevelId: level.id,
            questionText: "Q2",
            answerText: "A2",
            questionOrder: 2,
          },
        ],
      });

      // Create a second student account context to mock multi-student class submissions
      const studentRole = await createTestRoleWithPermissions(
        "StudentDefaultRole",
        [],
      );
      const { user: student2 } = await createAuthenticatedUser({
        roleId: studentRole.id,
        id: "new-student-id",
        email: "newStudent@test.com",
      });

      // Seed submission record for Student 1
      const attempt1 = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: lecturer.id, // Using the first authenticated user context as student 1
          submittedAt: new Date(),
          score: 100,
        },
      });

      // Seed submission record for Student 2
      const attempt2 = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: student2.id,
          submittedAt: new Date(),
          score: 50,
        },
      });

      // Request without query parameters to view the unfiltered global list
      const res = await app.handle(
        new Request("http://localhost/quizzes/attempts/results", {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );

      const json = await res.json();
      expect(res.status).toBe(200);

      // Expect both submissions to be loaded into the collection
      expect(json.data).toBeInstanceOf(Array);
      expect(json.data.length).toBeGreaterThanOrEqual(2);

      // Validate the structure matches the schema contracts exactly
      const record1 = json.data.find(
        (item: any) => item.attemptId === attempt1.id.toString(),
      );
      expect(record1).toBeDefined();
      expect(record1.quizTitle).toBe(quiz.title);
      expect(record1.levelTitle).toBe(level.title);
      expect(record1.score).toBe(100);
      expect(record1.totalQuestions).toBe(2);
      expect(record1.studentName).toBeDefined();
      expect(record1.studentEmail).toBeDefined();
    });

    it("should filter the bulk summary results accurately when query parameters are supplied", async () => {
      const role = await createTestRoleWithPermissions(
        "LecturerResultsReaderRole",
        [{ featureName: "quiz_management", action: "read" }],
      );

      const { user: lecturer, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { level: targetLevel } = await createMockQuizWithLevel(lecturer.id);
      const { level: isolatedLevel } = await createMockQuizWithLevel(
        lecturer.id,
      );

      // Seed submission on target level
      const targetAttempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: targetLevel.id,
          studentId: lecturer.id,
          submittedAt: new Date(),
          score: 80,
        },
      });

      // Seed alternative noise submission on the secondary level
      await prisma.quizAttempt.create({
        data: {
          quizLevelId: isolatedLevel.id,
          studentId: lecturer.id,
          submittedAt: new Date(),
          score: 90,
        },
      });

      // Execute request filtering strictly by quizLevelId
      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/attempts/results?quizLevelId=${targetLevel.id}`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      // The noise row should be filtered out from the response collection array
      const matches = json.data.filter(
        (item: any) => item.quizLevelId === targetLevel.id.toString(),
      );
      expect(json.data).toHaveLength(matches.length);
      expect(json.data[0].attemptId).toBe(targetAttempt.id.toString());
    });
  });
});
