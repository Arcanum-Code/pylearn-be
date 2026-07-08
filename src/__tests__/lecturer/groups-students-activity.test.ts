import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";
import { prisma } from "@/libs/prisma";

describe("Lecturer Groups Students Activity Endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should return matrix and drill-down details for enrolled student", async () => {
    const role = await createTestRoleWithPermissions("LecturerRole", [
      { featureName: "group_management", action: "read" },
    ]);

    const { authHeaders, user: lecturer } = await createAuthenticatedUser({
      roleId: role.id,
      email: "dosen@test.com",
    });

    // Create a student user
    const student = await prisma.user.create({
      data: {
        email: "budi@test.com",
        name: "Budi Santoso",
        password: "hash",
        roleId: role.id,
      },
    });

    // Create group, materials, quizzes, enrollments
    const group = await prisma.group.create({
      data: {
        name: "Python 101",
        materials: {
          create: [
            {
              title: "Mat 1",
              materialType: "markdown",
              sequence: 1,
              lecturerId: lecturer.id,
            },
            {
              title: "Mat 2",
              materialType: "markdown",
              sequence: 2,
              lecturerId: lecturer.id,
            },
          ],
        },
        quizzes: {
          create: [
            {
              title: "Quiz 1",
              levelNumber: 1,
              passThreshold: 70,
            },
          ],
        },
        enrollments: {
          create: {
            studentId: student.id,
          },
        },
      },
      include: {
        materials: true,
        quizzes: true,
      },
    });

    const mat1 = group.materials[0];
    const quiz1 = group.quizzes[0];

    // Create MaterialRead for mat1
    await prisma.materialRead.create({
      data: {
        materialId: mat1.id,
        studentId: student.id,
        materialVersion: 1,
        scrollPercentage: 100,
        readAt: new Date(),
      },
    });

    // Create QuizAttempt for quiz1
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz1.id,
        studentId: student.id,
        attemptNumber: 1,
        score: 95,
        startedAt: new Date(Date.now() - 10000),
        submittedAt: new Date(),
      },
    });

    // 1. Test GET /lecturer/groups/:groupId/students-activity
    const matrixRes = await app.handle(
      new Request(
        `http://localhost/lecturer/groups/${group.id}/students-activity`,
        {
          headers: authHeaders,
        },
      ),
    );

    expect(matrixRes.status).toBe(200);
    const matrixBody = await matrixRes.json();
    expect(matrixBody.error).toBe(false);
    expect(matrixBody.data.summary.total_students).toBe(1);
    expect(matrixBody.data.students[0].student_id).toBe(student.id);
    expect(matrixBody.data.students[0].overall_progress_percentage).toBe(50.0);
    expect(matrixBody.data.students[0].avg_quiz_score).toBe(95.0);
    expect(matrixBody.data.students[0].status).toBe("ON_TRACK");

    // 2. Test GET /lecturer/groups/:groupId/students/:studentId/activity
    const detailRes = await app.handle(
      new Request(
        `http://localhost/lecturer/groups/${group.id}/students/${student.id}/activity`,
        {
          headers: authHeaders,
        },
      ),
    );

    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.error).toBe(false);
    expect(detailBody.data.student.student_id).toBe(student.id);
    expect(detailBody.data.quiz_attempts_history).toHaveLength(1);
    expect(detailBody.data.quiz_attempts_history[0].score).toBe(95);
    expect(detailBody.data.material_reading_timeline).toHaveLength(1);
  });
});
