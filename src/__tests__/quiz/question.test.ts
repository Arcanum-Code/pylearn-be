import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  resetDatabase,
  randomIp,
} from "../test_utils";

describe("Quiz Questions API", () => {
  let authHeaders: any;
  let materialId: string;
  let quizId: string;
  let quizLevelId: string;

  beforeEach(async () => {
    await resetDatabase();

    const role = await createTestRoleWithPermissions("Admin", [
      { featureName: "material_management", action: "create" },
      { featureName: "material_management", action: "read" },
      { featureName: "quiz_management", action: "create" },
      { featureName: "quiz_management", action: "read" },
      { featureName: "quiz_management", action: "update" },
      { featureName: "quiz_management", action: "delete" },
    ]);

    const auth = await createAuthenticatedUser({ roleId: role.id });
    authHeaders = auth.authHeaders;

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    // 1. Create base Material
    const mResponse = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          lecturerId: auth.user.id,
          groupId: group.id,
          title: "Test Material",
          materialType: "text",
        }),
      }),
    );
    const mBody = await mResponse.json();
    materialId = mBody.data.id;

    // 2. Create base Quiz directly under Material
    const qResponse = await app.handle(
      new Request("http://localhost/quizzes", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          materialId: materialId,
          title: "Quiz 1",
        }),
      }),
    );
    const qBody = await qResponse.json();
    quizId = qBody.data.id;

    // 3. Create Quiz Level under Quiz
    const qlResponse = await app.handle(
      new Request("http://localhost/quizzes/levels", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          quizId: quizId,
          title: "Level 1",
          levelOrder: 1,
        }),
      }),
    );
    const qlBody = await qlResponse.json();
    quizLevelId = qlBody.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // POST /quizzes/questions (Create)
  // =========================================================================
  describe("POST /quizzes/questions", () => {
    it("should create questions with sequential order within a level", async () => {
      // First question
      const res1 = await app.handle(
        new Request("http://localhost/quizzes/questions", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizLevelId: quizLevelId, // Updated tracking property
            questionText: "Question 1",
            answerText: "Answer 1",
            maxScore: 50,
            questionOrder: 1,
          }),
        }),
      );
      expect(res1.status).toBe(201);
      const body1 = await res1.json();
      expect(body1.data.questionOrder).toBe(1);
      expect(body1.data.quizLevelId).toBe(quizLevelId);
      expect(body1.data.quizLevelTitle).toBe("Level 1");

      // Second question
      const res2 = await app.handle(
        new Request("http://localhost/quizzes/questions", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizLevelId: quizLevelId, // Updated tracking property
            questionText: "Question 2",
            answerText: "Answer 2",
            questionOrder: 2,
          }),
        }),
      );
      expect(res2.status).toBe(201);
      const body2 = await res2.json();
      expect(body2.data.questionOrder).toBe(2);
      expect(body2.data.maxScore).toBe(100); // Default property check
    });
  });

  // =========================================================================
  // GET /quizzes/questions (List by Query Param)
  // =========================================================================
  describe("GET /quizzes/questions", () => {
    it("should list questions with quiz level and quiz info", async () => {
      await prisma.quizQuestion.create({
        data: {
          quizLevelId: BigInt(quizLevelId), // Updated database relation
          questionText: "Question 1",
          answerText: "Answer 1",
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/questions?quizLevelId=${quizLevelId}`,
          {
            // Updated query string parameter
            method: "GET",
            headers: authHeaders,
          },
        ),
      );

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data.length).toBe(1);
      expect(body.data[0].quizLevelId).toBe(quizLevelId);
      expect(body.data[0].quizLevelTitle).toBe("Level 1");
      expect(body.data[0].quizTitle).toBe("Quiz 1");
    });
  });

  describe.only("GET /quizzes/questions/attempt", () => {
    it("should return questions for a level but strictly exclude answerText", async () => {
      await prisma.quizQuestion.create({
        data: {
          quizLevelId: BigInt(quizLevelId),
          questionText: "Secret Question?",
          answerText: "Highly Classified Answer Key",
          maxScore: 100,
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/questions/attempt?quizLevelId=${quizLevelId}`,
          {
            method: "GET",
            headers: authHeaders,
          },
        ),
      );

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.data.length).toBe(1);
      expect(body.data[0].questionText).toBe("Secret Question?");
      expect(body.data[0].maxScore).toBe(100);
      expect(body.data[0].questionOrder).toBe(1);

      expect(body.data[0].answerText).toBeUndefined();
    });

    it("should reject when candidate lacks read permission", async () => {
      const unauthorizedRole = await createTestRoleWithPermissions(
        "GuestRole",
        [],
      );
      const unauthorizedUser = await createAuthenticatedUser({
        roleId: unauthorizedRole.id,
        id: "new-unauthorized-user-id",
        email: "unauthorized@test.com",
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/questions/attempt?quizLevelId=${quizLevelId}`,
          {
            method: "GET",
            headers: unauthorizedUser.authHeaders,
          },
        ),
      );

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // PATCH /quizzes/questions/:id (Update)
  // =========================================================================
  describe("PATCH /quizzes/questions/:id", () => {
    it("should update question text and max score", async () => {
      const q = await prisma.quizQuestion.create({
        data: {
          quizLevelId: BigInt(quizLevelId), // Updated database relation
          questionText: "Original Text",
          answerText: "Original Answer",
          maxScore: 10,
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/questions/${q.id.toString()}`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            questionText: "Updated Text",
            answerText: "Updated Answer",
            maxScore: 20,
          }),
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.questionText).toBe("Updated Text");
      expect(body.data.answerText).toBe("Updated Answer");
      expect(body.data.maxScore).toBe(20);
    });
  });

  // =========================================================================
  // DELETE /quizzes/questions/:id (Delete and Reorder)
  // =========================================================================
  describe("DELETE /quizzes/questions/:id", () => {
    it("should allow deletion if not the last question and shift orders down", async () => {
      const q1 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: BigInt(quizLevelId),
          questionText: "Q1",
          answerText: "A1",
          questionOrder: 1,
        },
      });
      const q2 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: BigInt(quizLevelId),
          questionText: "Q2",
          answerText: "A2",
          questionOrder: 2,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/questions/${q1.id.toString()}`, {
          method: "DELETE",
          headers: authHeaders,
        }),
      );

      expect(res.status).toBe(200);

      // Verify cascading reorder shift happened inside this level group
      const secondaryQuestion = await prisma.quizQuestion.findUnique({
        where: { id: q2.id },
      });
      expect(secondaryQuestion?.questionOrder).toBe(1);
    });

    it("should allow deletion of the last question", async () => {
      const q1 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: BigInt(quizLevelId),
          questionText: "Q1",
          answerText: "A1",
          questionOrder: 1,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/questions/${q1.id.toString()}`, {
          method: "DELETE",
          headers: authHeaders,
        }),
      );

      expect(res.status).toBe(200);
      const count = await prisma.quizQuestion.count({
        where: { quizLevelId: BigInt(quizLevelId) },
      });
      expect(count).toBe(0);
    });
  });
});
