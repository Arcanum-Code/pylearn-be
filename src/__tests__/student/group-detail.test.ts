import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";

describe("Student Group Detail Timeline API", () => {
  let authHeaders: Record<string, string>;
  let groupId: string;
  let studentId: string;

  beforeEach(async () => {
    await resetDatabase();

    const studentRole = await createTestRoleWithPermissions("student", [
      { featureName: "student_material_access", action: "read" },
    ]);

    const studentUser = await createAuthenticatedUser({
      email: "student@test.com",
      roleId: studentRole.id,
    });
    authHeaders = studentUser.authHeaders;
    studentId = studentUser.user.id;

    const group = await prisma.group.create({
      data: { name: "Timeline Cohort" },
    });
    groupId = group.id;

    const quiz = await prisma.quiz.create({
      data: {
        groupId,
        title: "Timeline Quiz 1",
        description: "First Quiz",
        isPublished: true,
        levelNumber: 1,
        passThreshold: 70.0,
      },
    });

    // Create a submitted quiz attempt that passes threshold (score 80 >= 70)
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId,
        attemptNumber: 1,
        score: 80.0,
        submittedAt: new Date(),
      },
    });
  });

  it("should get student group detail timeline with passThreshold and isPassed true", async () => {
    const res = await app.handle(
      new Request(`http://localhost/student/groups/mahasiswa/${groupId}`, {
        headers: authHeaders,
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.groupName).toBe("Timeline Cohort");
    const quizItem = body.data.items.find((item: any) => item.type === "quiz");
    expect(quizItem).toBeDefined();
    expect(quizItem.passThreshold).toBe(70.0);
    expect(quizItem.bestScore).toBe(80.0);
    expect(quizItem.isPassed).toBe(true);
  });
});
