import { describe, expect, it, beforeEach } from "bun:test";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestUser,
} from "../test_utils";
import { app } from "../../server";
import { prisma } from "@/libs/prisma";

describe("Lecturer Quiz API", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should create a new quiz draft", async () => {
    const role = await createTestRoleWithPermissions("LecturerRole", [
      { featureName: "lecturer_quiz_access", action: "create" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "lecturer@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Test Group", description: "Test Group Desc" },
    });

    const req = new Request(
      `http://localhost/api/lecturer/groups/${group.id}/quizzes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level: 1,
          title: "Test Quiz",
          pass_threshold: 80,
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe("draft");
    expect(body.data.level).toBe(1);
  });

  it("should update quiz metadata and return warning if attempts exist", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleUpdate", [
      { featureName: "lecturer_quiz_access", action: "update" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "update@test.com",
    });

    // Setup group and quiz
    const group = await prisma.group.create({
      data: { name: "Update Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 5,
        title: "Old Title",
        passThreshold: 60,
        isPublished: false,
      },
    });

    // Create an attempt to trigger the warning logic
    const studentUser = await createTestUser({
      id: "student-user-id",
      email: "student2@test.com",
    });
    await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: studentUser.id, attemptNumber: 1 },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "New Title", pass_threshold: 75 }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.title).toBe("New Title");
    expect(body.data.pass_threshold).toBe(75);
    expect(body.data.warning).toBeDefined();
    expect(body.data.warning).toContain("existing attempts");
  });
});
