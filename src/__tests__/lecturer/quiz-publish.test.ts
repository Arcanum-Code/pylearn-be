import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";

describe("Lecturer Quiz API - Publish", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should reject publish if no published materials exist in group", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePublishFailMat",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_fail1@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Fail Group 1", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 15,
        title: "Pub Fail Quiz 1",
        passThreshold: 60,
        isPublished: false,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues.errors.length).toBeGreaterThan(0);
    expect(body.issues.errors[0].code).toBe("no_materials_in_group");
  });

  it("should reject publish if a question has no blanks", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePublishFailBlank",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token, user } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_fail2@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Fail Group 2", description: "Desc" },
    });
    // Add a published material so it passes the material check
    await prisma.material.create({
      data: {
        groupId: group.id,
        lecturerId: user.id,
        title: "Mat",
        materialType: "text",
        isPublished: true,
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 16,
        title: "Pub Fail Quiz 2",
        passThreshold: 60,
        isPublished: false,
      },
    });

    // Add question without blanks
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Q",
        answerText: "A",
        questionOrder: 1,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues.errors.length).toBeGreaterThan(0);
    expect(body.issues.errors[0].code).toBe("question_missing_blanks");
    expect(body.issues.errors[0].question_id).toBe(`q_${question.id}`);
  });

  it("should successfully publish a quiz", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePublishSuccess",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token, user } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_ok@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub OK Group", description: "Desc" },
    });
    await prisma.material.create({
      data: {
        groupId: group.id,
        lecturerId: user.id,
        title: "Mat",
        materialType: "text",
        isPublished: true,
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 17,
        title: "Pub OK Quiz",
        passThreshold: 60,
        isPublished: false,
      },
    });

    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Q",
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
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.quiz_id).toBe(`qz_${quiz.id}`);
    expect(body.data.status).toBe("published");

    const dbQuiz = await prisma.quiz.findUnique({ where: { id: quiz.id } });
    expect(dbQuiz?.isPublished).toBe(true);
  });

  it("should reject deleting a published quiz that has attempts", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleDelQFail", [
      { featureName: "lecturer_quiz_access", action: "delete" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "del_q_fail@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Del Q Group 1", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 24,
        title: "Del Q Fail",
        passThreshold: 60,
        isPublished: true,
      },
    });

    const studentUser = await createAuthenticatedUser({
      id: "student-user-id",
      roleId: role.id,
      email: "student1@test.com",
    });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: studentUser.user.id,
        attemptNumber: 1,
        score: 100,
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
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe(
      "Cannot delete a published quiz that has student attempts.",
    );
  });
});
