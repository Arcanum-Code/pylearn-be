import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("PATCH /quizzes/:id", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should update a quiz", async () => {
    const role = await createTestRoleWithPermissions("QuizUpdaterRole", [
      { featureName: "quiz_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "Original Title",
        publishedAt: null,
        levelNumber: 1,
      },
    });

    // Create a question with a keyword so publishing is allowed
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Question 1",
        answerText: "Answer is [blank]",
        questionOrder: 1,
      },
    });

    await prisma.questionKeyword.create({
      data: {
        questionId: question.id,
        blankOrder: 1,
        correctAnswer: "blank",
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          title: "Updated Title",
          publishedAt: new Date().toISOString(),
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.title).toBe("Updated Title");
    expect(json.data.publishedAt).not.toBeNull();
  });

  it("should reject publishing if quiz has no questions", async () => {
    const role = await createTestRoleWithPermissions("QuizUpdaterRole", [
      { featureName: "quiz_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "No Questions Quiz",
        publishedAt: null,
        levelNumber: 1,
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ publishedAt: new Date().toISOString() }),
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("A quiz with no questions cannot be published.");
  });

  it("should reject publishing if a question has zero blanks", async () => {
    const role = await createTestRoleWithPermissions("QuizUpdaterRole", [
      { featureName: "quiz_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "No Blanks Quiz",
        publishedAt: null,
        levelNumber: 1,
      },
    });

    // Create a question WITHOUT any keywords
    await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Question 1",
        answerText: "Answer",
        questionOrder: 1,
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ publishedAt: new Date().toISOString() }),
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe(
      "All questions must have at least one blank to be published.",
    );
  });

  it("should update quiz with new timing constraints", async () => {
    const role = await createTestRoleWithPermissions("QuizUpdaterRole", [
      { featureName: "quiz_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "Test Quiz",
        startTime: new Date("2025-01-01T00:00:00Z"),
        endTime: new Date("2025-01-02T00:00:00Z"),
        levelNumber: 1,
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          startTime: "2025-01-03T00:00:00Z",
          endTime: "2025-01-04T00:00:00Z",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.startTime).toBe("2025-01-03T00:00:00.000Z");
    expect(json.data.endTime).toBe("2025-01-04T00:00:00.000Z");
  });

  it("should reject invalid startTime/endTime on update", async () => {
    const role = await createTestRoleWithPermissions("QuizUpdaterRole", [
      { featureName: "quiz_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "Test Quiz",
        startTime: new Date("2025-01-01T00:00:00Z"),
        endTime: new Date("2025-01-02T00:00:00Z"),
        levelNumber: 1,
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          startTime: "2025-01-05T00:00:00Z",
          endTime: "2025-01-01T00:00:00Z",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Start time must be before end time");
  });

  it("should return 404 for non-existent quiz", async () => {
    const role = await createTestRoleWithPermissions("QuizUpdaterRole", [
      { featureName: "quiz_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/999999`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ title: "Updated Title" }),
      }),
    );

    expect(res.status).toBe(404);
  });

  it("should return 403 if user lacks 'update' permission", async () => {
    const role = await createTestRoleWithPermissions("QuizReaderRole", [
      { featureName: "quiz_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "Test Quiz",
        levelNumber: 1,
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ title: "Updated Title" }),
      }),
    );

    expect(res.status).toBe(403);
  });
});
