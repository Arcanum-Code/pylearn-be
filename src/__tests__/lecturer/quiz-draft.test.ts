import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestUser,
} from "../test_utils";

describe("Lecturer Quiz API - Draft & Metadata", () => {
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

  it("should get full quiz details by ID", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleGetQ", [
      { featureName: "lecturer_quiz_access", action: "read" },
    ]);
    const { token, user } = await createAuthenticatedUser({
      roleId: role.id,
      email: "get_q@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Get Q Group", description: "Desc" },
    });
    await prisma.material.create({
      data: {
        groupId: group.id,
        lecturerId: user.id,
        title: "Gate Mat",
        materialType: "text",
        isPublished: true,
      },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 23,
        title: "Get Quiz",
        passThreshold: 75,
        isPublished: false,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Q?",
        answerText: "A",
        questionOrder: 1,
      },
    });
    await prisma.questionKeyword.create({
      data: {
        questionId: question.id,
        blankOrder: 1,
        correctAnswer: "A",
        startIndex: 0,
        endIndex: 1,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.quiz_id).toBe(`qz_${quiz.id}`);
    expect(body.data.pass_threshold).toBe(75);
    expect(body.data.status).toBe("draft");
    expect(body.data.questions.length).toBe(1);
    expect(body.data.questions[0].blanks.length).toBe(1);
    expect(body.data.gating_materials.length).toBe(1);
    expect(body.data.gating_materials[0].title).toBe("Gate Mat");
  });

  it("should successfully delete a draft quiz", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRoleDelQSuccess",
      [{ featureName: "lecturer_quiz_access", action: "delete" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "del_q_ok@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Del Q Group 2", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 25,
        title: "Del Q Success",
        passThreshold: 60,
        isPublished: false,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(204);

    const deletedQuiz = await prisma.quiz.findUnique({
      where: { id: quiz.id },
    });
    expect(deletedQuiz).toBeNull();
  });
});
