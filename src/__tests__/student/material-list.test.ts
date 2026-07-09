import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestUser,
} from "../test_utils";

describe("Student Material API - List", () => {
  let authHeaders: Record<string, string>;
  let groupId: string;

  beforeEach(async () => {
    await resetDatabase();

    // Seed role & permissions
    const studentRole = await createTestRoleWithPermissions("student", [
      { featureName: "student_material_access", action: "read" },
    ]);

    // Create authenticated student
    const studentUser = await createAuthenticatedUser({
      email: "student@test.com",
      roleId: studentRole.id,
    });
    authHeaders = studentUser.authHeaders;

    // Create lecturer
    const lecturer = await createTestUser({
      email: "lec@test.com",
      id: "lecturer-user-id",
    });

    // Create group & materials
    const group = await prisma.group.create({ data: { name: "Test Group" } });
    groupId = group.id;

    await prisma.material.create({
      data: {
        title: "Mat 1",
        materialType: "file",
        content: "/storage/1.pdf",
        groupId,
        lecturerId: lecturer.id,
        sequence: 1,
        publishedAt: new Date(Date.now() - 100000),
      },
    });

    await prisma.material.create({
      data: {
        title: "Mat 2",
        materialType: "file",
        content: "/storage/2.pdf",
        groupId,
        lecturerId: lecturer.id,
        sequence: 2,
        publishedAt: new Date(Date.now() - 100000),
      },
    });

    await prisma.quiz.create({
      data: {
        groupId,
        title: "Quiz Level 1",
        description: "Test quiz",
        isPublished: true,
        levelNumber: 1,
        passThreshold: 75.0,
      },
    });
  });

  it("should get group materials with default progress and quizzes", async () => {
    const res = await app.handle(
      new Request(`http://localhost/student/groups/${groupId}/materials`, {
        headers: authHeaders,
      }),
    );
    const body = await res.json();
    console.log("RESPONSE BODY:", body);
    expect(res.status).toBe(200);
    expect(body.data.group_name).toBe("Test Group");
    expect(body.data.materials.length).toBe(2);
    expect(body.data.materials[0].status).toBe("not_started");
    expect(body.data.quizzes.length).toBe(1);
    expect(body.data.quizzes[0].title).toBe("Quiz Level 1");
    expect(body.data.quizzes[0].pass_threshold).toBe(75.0);
    expect(body.data.quizzes[0].is_passed).toBe(null);
    expect(body.data.quizzes[0].best_score).toBe(null);
  });
});
