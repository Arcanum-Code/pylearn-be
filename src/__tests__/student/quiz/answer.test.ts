import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";

import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../../test_utils";

async function createMockQuestion(userId: string) {
  const group = await prisma.group.create({
    data: { name: "Default Group", description: "Default group for tests" },
  });

  const quiz = await prisma.quiz.create({
    data: {
      groupId: group.id,
      title: "Answer Quiz",
      isPublished: true,
      levelNumber: 1,
    },
  });

  const question = await prisma.quizQuestion.create({
    data: {
      quizId: quiz.id,
      questionText: "What is OOP?",
      answerText: "Object Oriented Programming",
      maxScore: 100,
      questionOrder: 1,
    },
  });

  return {
    quiz,
    question,
  };
}

describe("Quiz Answers Management Integration Tests", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /quizzes/answers", () => {
    it("should create correct answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "student_quiz_access", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText: "Object Oriented Programming",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.quizAttemptId).toBe(attempt.id.toString());
      expect(json.data.quizQuestionId).toBe(question.id.toString());
    });

    it("should strip out HTML rich text markup tags and match correctly", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "student_quiz_access", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText:
              "<p>  Object Oriented <strong>Programming</strong>&nbsp;</p>",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe(
        "<p>  Object Oriented <strong>Programming</strong>&nbsp;</p>",
      );
    });

    it("should create incorrect answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "student_quiz_access", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText: "Wrong Answer",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.isCorrect).toBe(false);
    });

    it("should reject without permission", async () => {
      const role = await createTestRoleWithPermissions("AnswerReaderRole", [
        { featureName: "student_quiz_access", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText: "Object Oriented Programming",
          }),
        }),
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /quizzes/answers", () => {
    it("should return answers", async () => {
      const role = await createTestRoleWithPermissions("AnswerReaderRole", [
        { featureName: "student_quiz_access", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "Object Oriented Programming",
          isCorrect: true,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/answers?quizAttemptId=${attempt.id}`,
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
      expect(json.data[0].isCorrect).toBe(true);
    });
  });

  describe("PATCH /quizzes/answers/:id", () => {
    it("should update answer and evaluate accuracy logic automatically", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "student_quiz_access", action: "update" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const answer = await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "Wrong Initial Answer",
          isCorrect: false,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/student/quizzes/answers/${answer.id}`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            answerText: "Object Oriented Programming",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe("Object Oriented Programming");
    });

    it("should strip out HTML markup tags during update modifications and grade accurately", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "student_quiz_access", action: "update" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      const answer = await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "Wrong Initial Answer",
          isCorrect: false,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/student/quizzes/answers/${answer.id}`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            answerText: "<div>\nObject Oriented Programming\n</div>",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe(
        "<div>\nObject Oriented Programming\n</div>",
      );
    });

    it("should return 404 for non-existent answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "student_quiz_access", action: "update" },
      ]);

      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const res = await app.handle(
        new Request("http://localhost/student/quizzes/answers/999999", {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            answerText: "Updated Answer",
          }),
        }),
      );

      expect(res.status).toBe(404);
    });
  });
});
