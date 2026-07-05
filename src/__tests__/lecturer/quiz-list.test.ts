import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";

describe("Lecturer Quiz API - List", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should list all quizzes in a group", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleListQ", [
      { featureName: "lecturer_quiz_access", action: "read" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "list_q@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "List Q Group", description: "Desc" },
    });
    await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 21,
        title: "Quiz 21",
        passThreshold: 60,
        isPublished: true,
      },
    });
    await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 22,
        title: "Quiz 22",
        passThreshold: 60,
        isPublished: false,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/groups/${group.id}/quizzes`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.quizzes.length).toBe(2);
    expect(body.data.quizzes[0].level).toBe(21);
    expect(body.data.quizzes[0].status).toBe("published");
    expect(body.data.quizzes[1].level).toBe(22);
    expect(body.data.quizzes[1].status).toBe("draft");
    expect(body.data.quizzes[1].question_count).toBe(0);
  });
});
