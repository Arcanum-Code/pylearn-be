import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("DELETE /quizzes/:id", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should delete a quiz", async () => {
    const role = await createTestRoleWithPermissions("QuizDeleterRole", [
      { featureName: "quiz_management", action: "delete" },
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
        method: "DELETE",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(quiz.id.toString());

    const deleted = await prisma.quiz.findUnique({ where: { id: quiz.id } });
    expect(deleted).toBeNull();
  });

  it("should return 404 for non-existent quiz", async () => {
    const role = await createTestRoleWithPermissions("QuizDeleterRole", [
      { featureName: "quiz_management", action: "delete" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request(`http://localhost/quizzes/999999`, {
        method: "DELETE",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("should return 403 if user lacks 'delete' permission", async () => {
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
        method: "DELETE",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(res.status).toBe(403);
  });
});
