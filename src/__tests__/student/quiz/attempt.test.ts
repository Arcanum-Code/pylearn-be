import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";

import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../../test_utils";

async function createMockQuiz(userId: string, levelNumber = 1) {
  const group = await prisma.group.create({
    data: { name: "Default Group", description: "Default group for tests" },
  });

  const quiz = await prisma.quiz.create({
    data: {
      groupId: group.id,
      title: `Attempt Quiz L${levelNumber}`,
      isPublished: true,
      levelNumber,
    },
  });

  return { quiz, group };
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
    it("should create quiz attempt targeting a quiz", async () => {
      const role = await createTestRoleWithPermissions("AttemptCreatorRole", [
        {
          featureName: "student_quiz_access",
          action: "create",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizId: quiz.id.toString(),
          }),
        }),
      );

      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.data.quizId).toBe(quiz.id.toString());
      expect(json.data.studentId).toBe(user.id);
    });

    it("should reject duplicate active attempt per quiz", async () => {
      const role = await createTestRoleWithPermissions("AttemptCreatorRole", [
        {
          featureName: "student_quiz_access",
          action: "create",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
          submittedAt: null,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizId: quiz.id.toString(),
          }),
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should reject attempt if previous level quiz is not passed", async () => {
      const role = await createTestRoleWithPermissions("AttemptCreatorRole", [
        { featureName: "student_quiz_access", action: "create" },
      ]);
      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const group = await prisma.group.create({ data: { name: "G1" } });
      const quiz1 = await prisma.quiz.create({
        data: {
          groupId: group.id,
          title: "L1",
          levelNumber: 1,
          passThreshold: 70,
        },
      });
      const quiz2 = await prisma.quiz.create({
        data: {
          groupId: group.id,
          title: "L2",
          levelNumber: 2,
          passThreshold: 70,
        },
      });

      // No attempt for L1 -> should fail
      const res = await app.handle(
        new Request("http://localhost/student/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({ quizId: quiz2.id.toString() }),
        }),
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("You must pass Quiz Level 1");
    });

    it("should reject without permission", async () => {
      const role = await createTestRoleWithPermissions("AttemptReaderRole", [
        {
          featureName: "student_quiz_access",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/attempts", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizId: quiz.id.toString(),
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
          featureName: "student_quiz_access",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts?quizId=${quiz.id}`,
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
      expect(json.data).toHaveLength(1);
      expect(json.data[0].quizId).toBe(quiz.id.toString());
    });
  });

  // =========================================
  // GET /quizzes/attempts/:id
  // =========================================
  describe("GET /quizzes/attempts/:id", () => {
    it("should return attempt detail", async () => {
      const role = await createTestRoleWithPermissions("AttemptReaderRole", [
        {
          featureName: "student_quiz_access",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/student/quizzes/attempts/${attempt.id}`, {
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
      expect(json.data.quizId).toBe(quiz.id.toString());
    });
  });

  // =========================================
  // PATCH /quizzes/attempts/:id/submit
  // =========================================
  describe("PATCH /quizzes/attempts/:id/submit", () => {
    it("should submit attempt", async () => {
      const role = await createTestRoleWithPermissions("AttemptUpdaterRole", [
        {
          featureName: "student_quiz_access",
          action: "update",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/${attempt.id}/submit`,
          {
            method: "PATCH",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
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
    it("should return quizzes with NOT_STARTED status when no answers or attempts exist", async () => {
      const role = await createTestRoleWithPermissions("StatusReaderRole", [
        {
          featureName: "student_quiz_access",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: "Sample Question?",
          answerText: "Answer",
          maxScore: 10,
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/status/me?quizId=${quiz.id}`,
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

      expect(json.data.groupId).toBe(quiz.groupId);
      expect(json.data.progress).toHaveLength(1);
      expect(json.data.progress[0].quizId).toBe(quiz.id.toString());
      expect(json.data.progress[0].status).toBe("NOT_STARTED");
      expect(json.data.progress[0].currentAttemptId).toBeNull();
      expect(json.data.progress[0].totalQuestions).toBe(1);
    });

    it("should return IN_PROGRESS status when an unsubmitted attempt exists", async () => {
      const role = await createTestRoleWithPermissions("StatusReaderRole", [
        { featureName: "student_quiz_access", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz } = await createMockQuiz(user.id);

      const question = await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: "What is Bun?",
          answerText: "A fast runtime",
          maxScore: 10,
          questionOrder: 1,
        },
      });

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
          submittedAt: null,
        },
      });

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
          `http://localhost/student/quizzes/attempts/status/me?quizId=${quiz.id}`,
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

      expect(json.data.progress[0].status).toBe("IN_PROGRESS");
      expect(json.data.progress[0].currentAttemptId).toBe(
        attempt.id.toString(),
      );
      expect(json.data.attemptHistory).toHaveLength(1);
    });

    it("should return COMPLETED status when a finalized attempt exists", async () => {
      const role = await createTestRoleWithPermissions("StatusReaderRole", [
        {
          featureName: "student_quiz_access",
          action: "read",
        },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
          submittedAt: new Date(),
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/status/me?quizId=${quiz.id}`,
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

      expect(json.data.progress[0].status).toBe("COMPLETED");
      expect(json.data.progress[0].currentAttemptId).toBe(
        attempt.id.toString(),
      );
      expect(json.data.attemptHistory).toHaveLength(1);
    });
  });

  // =========================================
  // GET /quizzes/attempts/:id/results
  // =========================================
  describe("GET /quizzes/attempts/:id/results", () => {
    it("should return detailed evaluation mapping for a submitted attempt", async () => {
      const role = await createTestRoleWithPermissions("ResultReaderRole", [
        { featureName: "student_quiz_access", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz } = await createMockQuiz(user.id);

      const q1 = await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: "What is Bun?",
          answerText: "A JS runtime",
          maxScore: 50,
          questionOrder: 1,
        },
      });

      const q2 = await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionText: "Is Prisma an ORM?",
          answerText: "Yes",
          maxScore: 50,
          questionOrder: 2,
        },
      });

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
          submittedAt: new Date(),
          score: 50,
        },
      });

      await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: q1.id,
          answerText: "A JS runtime",
          isCorrect: true,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/${attempt.id}/results`,
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

      expect(json.data.attemptId).toBe(attempt.id.toString());
      expect(json.data.score).toBe(50);
      expect(json.data.details).toHaveLength(2);

      const parsedQ1 = json.data.details.find(
        (d: any) => d.questionId === q1.id.toString(),
      );
      expect(parsedQ1.isCorrect).toBe(true);
      expect(parsedQ1.userAnswer).toBe("A JS runtime");

      const parsedQ2 = json.data.details.find(
        (d: any) => d.questionId === q2.id.toString(),
      );
      expect(parsedQ2.isCorrect).toBe(false);
      expect(parsedQ2.userAnswer).toBeNull();
      expect(parsedQ2.correctAnswer).toBe("Yes");
    });

    it("should reject 400 if attempt is not yet submitted", async () => {
      const role = await createTestRoleWithPermissions("ResultReaderRole", [
        { featureName: "student_quiz_access", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz } = await createMockQuiz(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
          submittedAt: null,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/${attempt.id}/results`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(400);
    });
  });

  // =======================================================================
  // GET /quizzes/attempts/results (Bulk Summary / Lecturer View)
  // =======================================================================
  describe("GET /quizzes/attempts/results", () => {
    it("should return high-level summary logs of all quiz attempts for lecturer tracking", async () => {
      const role = await createTestRoleWithPermissions(
        "LecturerResultsReaderRole",
        [{ featureName: "student_quiz_access", action: "read" }],
      );

      const { user: lecturer, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz } = await createMockQuiz(lecturer.id);

      await prisma.quizQuestion.createMany({
        data: [
          {
            quizId: quiz.id,
            questionText: "Q1",
            answerText: "A1",
            questionOrder: 1,
          },
          {
            quizId: quiz.id,
            questionText: "Q2",
            answerText: "A2",
            questionOrder: 2,
          },
        ],
      });

      const studentRole = await createTestRoleWithPermissions(
        "StudentDefaultRole",
        [],
      );
      const { user: student2 } = await createAuthenticatedUser({
        roleId: studentRole.id,
        id: "new-student-id",
        email: "newStudent@test.com",
      });

      const attempt1 = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: lecturer.id,
          submittedAt: new Date(),
          score: 100,
        },
      });

      const attempt2 = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: student2.id,
          submittedAt: new Date(),
          score: 50,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/attempts/results", {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );

      const json = await res.json();
      expect(res.status).toBe(200);

      expect(json.data).toBeInstanceOf(Array);
      expect(json.data.length).toBeGreaterThanOrEqual(2);

      const record1 = json.data.find(
        (item: any) => item.attemptId === attempt1.id.toString(),
      );
      expect(record1).toBeDefined();
      expect(record1.quizTitle).toBe(quiz.title);
      expect(record1.levelNumber).toBe(quiz.levelNumber);
      expect(record1.score).toBe(100);
      expect(record1.totalQuestions).toBe(2);
      expect(record1.studentName).toBeDefined();
      expect(record1.studentEmail).toBeDefined();
    });

    it("should filter the bulk summary results accurately when query parameters are supplied", async () => {
      const role = await createTestRoleWithPermissions(
        "LecturerResultsReaderRole",
        [{ featureName: "student_quiz_access", action: "read" }],
      );

      const { user: lecturer, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const { quiz: targetQuiz } = await createMockQuiz(lecturer.id, 1);
      const { quiz: isolatedQuiz } = await createMockQuiz(lecturer.id, 2);

      const targetAttempt = await prisma.quizAttempt.create({
        data: {
          quizId: targetQuiz.id,
          studentId: lecturer.id,
          submittedAt: new Date(),
          score: 80,
        },
      });

      await prisma.quizAttempt.create({
        data: {
          quizId: isolatedQuiz.id,
          studentId: lecturer.id,
          submittedAt: new Date(),
          score: 90,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/results?quizId=${targetQuiz.id}`,
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

      const matches = json.data.filter(
        (item: any) => item.quizId === targetQuiz.id.toString(),
      );
      expect(json.data).toHaveLength(matches.length);
      expect(json.data[0].attemptId).toBe(targetAttempt.id.toString());
    });
  });
});
