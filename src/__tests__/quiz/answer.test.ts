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

// =========================================================================
// Helpers
// =========================================================================
async function createMockQuestion(userId: string) {
  const material = await createTestMaterial(userId);

  const quiz = await prisma.quiz.create({
    data: {
      materialId: material.id,
      title: "Answer Quiz",
      isPublished: true,
    },
  });

  const level = await prisma.quizLevel.create({
    data: {
      quizId: quiz.id,
      title: "Level 1",
      levelOrder: 1,
    },
  });

  const question = await prisma.quizQuestion.create({
    data: {
      quizLevelId: level.id,
      questionText: "What is OOP?",
      answerText: "Object Oriented Programming",
      maxScore: 100,
      questionOrder: 1,
    },
  });

  return {
    quiz,
    level,
    question,
  };
}

// =========================================================================
// Main Quiz Answers Test Suite
// =========================================================================
describe("Quiz Answers Management Integration Tests", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =======================================================================
  // POST /quizzes/answers
  // =======================================================================
  describe("POST /quizzes/answers", () => {
    it("should create correct answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "quiz_management", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
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
        { featureName: "quiz_management", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            // Mimic typical output from WYSIWYG editors (TinyMCE, CKEditor, Quill)
            answerText:
              "<p>  Object Oriented <strong>Programming</strong>&nbsp;</p>",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();

      // Verification rules: tags removed, space entities unrolled, match succeeds
      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe(
        "<p>  Object Oriented <strong>Programming</strong>&nbsp;</p>",
      );
    });

    it("should create incorrect answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "quiz_management", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
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
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
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

  // =======================================================================
  // GET /quizzes/answers
  // =======================================================================
  describe("GET /quizzes/answers", () => {
    it("should return answers", async () => {
      const role = await createTestRoleWithPermissions("AnswerReaderRole", [
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
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
          `http://localhost/quizzes/answers?quizAttemptId=${attempt.id}`,
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

  // =======================================================================
  // PATCH /quizzes/answers/:id
  // =======================================================================
  describe("PATCH /quizzes/answers/:id", () => {
    it("should update answer and evaluate accuracy logic automatically", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "quiz_management", action: "update" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
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
        new Request(`http://localhost/quizzes/answers/${answer.id}`, {
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

    // 🧪 NEW: HTML rich text evaluation on update action paths
    it("should strip out HTML markup tags during update modifications and grade accurately", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "quiz_management", action: "update" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
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
        new Request(`http://localhost/quizzes/answers/${answer.id}`, {
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
        { featureName: "quiz_management", action: "update" },
      ]);

      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers/999999", {
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
