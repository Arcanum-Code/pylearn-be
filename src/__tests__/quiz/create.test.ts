import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("POST /quizzes", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should create a quiz", async () => {
    const role = await createTestRoleWithPermissions("QuizCreatorRole", [
      { featureName: "quiz_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const res = await app.handle(
      new Request(`http://localhost/quizzes`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          groupId: group.id,
          title: "New Quiz",
          description: "Test description",
          levelNumber: 1,
          passThreshold: 75.0,
        }),
      }),
    );

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.title).toBe("New Quiz");
    expect(json.data.description).toBe("Test description");
    expect(json.data.groupId).toBe(group.id);
    expect(json.data.levelNumber).toBe(1);
    expect(json.data.passThreshold).toBe(75.0);
  });

  it("should create quiz with timing constraints", async () => {
    const role = await createTestRoleWithPermissions("QuizCreatorRole", [
      { featureName: "quiz_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const res = await app.handle(
      new Request(`http://localhost/quizzes`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          groupId: group.id,
          title: "Timed Quiz",
          startTime: "2025-01-01T00:00:00Z",
          endTime: "2025-01-02T00:00:00Z",
          levelNumber: 1,
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.startTime).toBe("2025-01-01T00:00:00.000Z");
    expect(json.data.endTime).toBe("2025-01-02T00:00:00.000Z");
  });

  it("should reject when user lacks create permission", async () => {
    const role = await createTestRoleWithPermissions("QuizReaderRole", [
      { featureName: "quiz_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const res = await app.handle(
      new Request(`http://localhost/quizzes`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          groupId: group.id,
          title: "Test Quiz",
          levelNumber: 1,
        }),
      }),
    );

    expect(res.status).toBe(403);
  });
});
