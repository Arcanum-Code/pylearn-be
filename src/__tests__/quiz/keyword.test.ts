import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  resetDatabase,
} from "../test_utils";

describe("Question Keywords API", () => {
  let authHeaders: any;
  let quizId: string;

  beforeEach(async () => {
    await resetDatabase();

    const role = await createTestRoleWithPermissions("Admin", [
      { featureName: "quiz_management", action: "create" },
      { featureName: "quiz_management", action: "read" },
      { featureName: "quiz_management", action: "update" },
      { featureName: "quiz_management", action: "delete" },
    ]);

    const auth = await createAuthenticatedUser({ roleId: role.id });
    authHeaders = auth.authHeaders;

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const qResponse = await app.handle(
      new Request(`http://localhost/quizzes`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: "Quiz 1",
          groupId: group.id,
          levelNumber: 1,
        }),
      }),
    );
    const qBody = await qResponse.json();
    quizId = qBody.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /quizzes/keywords", () => {
    it("should create a keyword", async () => {
      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/keywords", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            questionId: question.id.toString(),
            blankOrder: 1,
            correctAnswer: "answer1",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.blankOrder).toBe(1);
      expect(body.data.correctAnswer).toBe("answer1");
      expect(body.data.quizId).toBe(quizId);
      expect(body.data.quizTitle).toBe("Quiz 1");
    });

    it("should reject duplicate blankOrder per question", async () => {
      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      await prisma.questionKeyword.create({
        data: {
          questionId: question.id,
          blankOrder: 1,
          correctAnswer: "first",
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/keywords", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            questionId: question.id.toString(),
            blankOrder: 1,
            correctAnswer: "duplicate",
          }),
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should reject when user lacks create permission", async () => {
      const readOnlyRole = await createTestRoleWithPermissions("ReadOnlyQuiz", [
        { featureName: "quiz_management", action: "read" },
      ]);
      const readOnlyAuth = await createAuthenticatedUser({
        id: "read-only-test",
        email: "readonly@hello.com",
        roleId: readOnlyRole.id,
      });

      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/keywords", {
          method: "POST",
          headers: {
            ...readOnlyAuth.authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            questionId: question.id.toString(),
            blankOrder: 1,
            correctAnswer: "test",
          }),
        }),
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /quizzes/keywords", () => {
    it("should list keywords with quiz info", async () => {
      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      await prisma.questionKeyword.create({
        data: {
          questionId: question.id,
          blankOrder: 1,
          correctAnswer: "answer1",
        },
      });
      await prisma.questionKeyword.create({
        data: {
          questionId: question.id,
          blankOrder: 2,
          correctAnswer: "answer2",
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/keywords?questionId=${question.id.toString()}`,
          {
            method: "GET",
            headers: authHeaders,
          },
        ),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].blankOrder).toBe(1);
      expect(body.data[1].blankOrder).toBe(2);
    });

    it("should return empty list when no keywords exist", async () => {
      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/keywords?questionId=${question.id.toString()}`,
          {
            method: "GET",
            headers: authHeaders,
          },
        ),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
    });
  });

  describe("PATCH /quizzes/keywords/:id", () => {
    it("should update a keyword", async () => {
      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      const keyword = await prisma.questionKeyword.create({
        data: {
          questionId: question.id,
          blankOrder: 1,
          correctAnswer: "original",
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/keywords/${keyword.id.toString()}`,
          {
            method: "PATCH",
            headers: {
              ...authHeaders,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              blankOrder: 2,
              correctAnswer: "updated",
            }),
          },
        ),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.blankOrder).toBe(2);
      expect(body.data.correctAnswer).toBe("updated");
    });

    it("should return 404 for non-existent keyword", async () => {
      const res = await app.handle(
        new Request(`http://localhost/quizzes/keywords/999999`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({ correctAnswer: "updated" }),
        }),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /quizzes/keywords/:id", () => {
    it("should delete a keyword", async () => {
      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      const keyword = await prisma.questionKeyword.create({
        data: {
          questionId: question.id,
          blankOrder: 1,
          correctAnswer: "to delete",
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/keywords/${keyword.id.toString()}`,
          {
            method: "DELETE",
            headers: authHeaders,
          },
        ),
      );

      expect(res.status).toBe(200);

      const deleted = await prisma.questionKeyword.findUnique({
        where: { id: keyword.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent keyword", async () => {
      const res = await app.handle(
        new Request(`http://localhost/quizzes/keywords/999999`, {
          method: "DELETE",
          headers: authHeaders,
        }),
      );

      expect(res.status).toBe(404);
    });

    it("should reject when user lacks delete permission", async () => {
      const readOnlyRole = await createTestRoleWithPermissions("ReadOnlyQuiz", [
        { featureName: "quiz_management", action: "read" },
      ]);
      const readOnlyAuth = await createAuthenticatedUser({
        id: "read-only-test",
        email: "readonly@hello.com",
        roleId: readOnlyRole.id,
      });

      const question = await prisma.quizQuestion.create({
        data: {
          quizId: BigInt(quizId),
          questionText: "Fill in the blank",
          answerText: "Test answer",
          questionOrder: 1,
        },
      });

      const keyword = await prisma.questionKeyword.create({
        data: {
          questionId: question.id,
          blankOrder: 1,
          correctAnswer: "to delete",
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/keywords/${keyword.id.toString()}`,
          {
            method: "DELETE",
            headers: readOnlyAuth.authHeaders,
          },
        ),
      );

      expect(res.status).toBe(403);
    });
  });
});
