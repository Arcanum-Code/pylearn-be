import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("GET /quizzes", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should return quizzes for a group", async () => {
    const role = await createTestRoleWithPermissions("QuizReaderRole", [
      { featureName: "quiz_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "Quiz 1",
        description: "Test quiz",
        isPublished: true,
        levelNumber: 1,
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes?groupId=${group.id}`, {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Quiz 1");
    expect(json.data[0].groupId).toBe(group.id);
  });

  it("should return empty list when no quizzes exist", async () => {
    const role = await createTestRoleWithPermissions("QuizReaderRole", [
      { featureName: "quiz_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const res = await app.handle(
      new Request(`http://localhost/quizzes?groupId=${group.id}`, {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("should return 401 without authentication", async () => {
    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const res = await app.handle(
      new Request(`http://localhost/quizzes?groupId=${group.id}`, {
        method: "GET",
      }),
    );

    expect(res.status).toBe(401);
  });

  it("should return 403 if user lacks 'read' permission", async () => {
    const role = await createTestRoleWithPermissions("NoQuizPermsRole", []);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const res = await app.handle(
      new Request(`http://localhost/quizzes?groupId=${group.id}`, {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(res.status).toBe(403);
  });
});
