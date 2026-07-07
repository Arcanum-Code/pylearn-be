import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { DashboardService } from "../../modules/dashboard/service";
import { prisma } from "../../libs/prisma";
import { createTestRoleWithPermissions, resetDatabase } from "../test_utils";
import pino from "pino";

describe("DashboardService - getSummary", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should return default summary when group has no data", async () => {
    const log = pino({ level: "silent" });
    const result = await DashboardService.getSummary("dummy-group", log);
    expect(result.group_id).toBe("dummy-group");
    expect(result.total_students).toBe(0);
    expect(result.avg_materials_read).toBe(0.0);
    expect(result.total_materials).toBe(0);
    expect(result.avg_pass_rate).toBe(0.0);
  });

  it("should compute correct summary metrics when students, materials, reads, and quiz attempts exist", async () => {
    const log = pino({ level: "silent" });

    // 1. Create a student role "Mahasiswa"
    const studentRole = await createTestRoleWithPermissions("Mahasiswa", []);
    const lecturerRole = await createTestRoleWithPermissions("Dosen", []);

    // 2. Create lecturer and active student users
    const lecturer = await prisma.user.create({
      data: {
        email: "lecturer@test.com",
        password: "hashed_password",
        name: "Lecturer One",
        roleId: lecturerRole.id,
        isActive: true,
      },
    });

    const student1 = await prisma.user.create({
      data: {
        email: "student1@test.com",
        password: "hashed_password",
        name: "Student One",
        roleId: studentRole.id,
        isActive: true,
      },
    });

    const student2 = await prisma.user.create({
      data: {
        email: "student2@test.com",
        password: "hashed_password",
        name: "Student Two",
        roleId: studentRole.id,
        isActive: true,
      },
    });

    // 3. Create a group
    const group = await prisma.group.create({
      data: {
        name: "Test Python Group",
        description: "Group for testing summary metrics",
      },
    });

    // 4. Create two materials in the group
    const material1 = await prisma.material.create({
      data: {
        title: "Material 1",
        materialType: "TEXT",
        groupId: group.id,
        lecturerId: lecturer.id,
      },
    });

    const material2 = await prisma.material.create({
      data: {
        title: "Material 2",
        materialType: "TEXT",
        groupId: group.id,
        lecturerId: lecturer.id,
      },
    });

    // 5. Create material read records
    // Student 1 reads material 1
    await prisma.materialRead.create({
      data: {
        materialId: material1.id,
        studentId: student1.id,
        materialVersion: 1,
        readAt: new Date(),
      },
    });

    // Student 2 reads material 1 and material 2
    await prisma.materialRead.create({
      data: {
        materialId: material1.id,
        studentId: student2.id,
        materialVersion: 1,
        readAt: new Date(),
      },
    });

    await prisma.materialRead.create({
      data: {
        materialId: material2.id,
        studentId: student2.id,
        materialVersion: 1,
        readAt: new Date(),
      },
    });

    // 6. Create a quiz in the group
    const quiz = await prisma.quiz.create({
      data: {
        title: "Quiz 1",
        groupId: group.id,
        levelNumber: 1,
        passThreshold: 70.0,
      },
    });

    // 7. Create quiz attempts
    // Student 1: score 80 (passed), submitted today (current week)
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student1.id,
        attemptNumber: 1,
        score: 80.0,
        submittedAt: new Date(),
      },
    });

    // Student 2: score 50 (failed), submitted 10 days ago (previous week)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student2.id,
        attemptNumber: 1,
        score: 50.0,
        submittedAt: tenDaysAgo,
      },
    });

    // 8. Fetch and verify summary
    const result = await DashboardService.getSummary(group.id, log);

    expect(result.group_id).toBe(group.id);
    expect(result.total_students).toBe(2);
    expect(result.total_materials).toBe(2);
    expect(result.avg_materials_read).toBe(1.5);
    expect(result.avg_pass_rate).toBe(50.0);
    expect(result.pass_rate_trend.current_week).toBe(100.0);
    expect(result.pass_rate_trend.previous_week).toBe(0.0);
    expect(result.pass_rate_trend.delta).toBe(100.0);
  });
});
