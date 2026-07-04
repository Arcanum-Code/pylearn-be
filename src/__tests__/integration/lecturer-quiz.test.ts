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

  it("should add a new question to a quiz", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleQuestion", [
      { featureName: "lecturer_quiz_access", action: "update" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "question@test.com",
    });

    // Setup group and quiz
    const group = await prisma.group.create({
      data: { name: "Question Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 10,
        title: "Question Quiz",
        passThreshold: 60,
        isPublished: false,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}/questions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_text: "Explain how a for-loop iterates.",
          key_answer_text: "A for-loop uses range directly.",
          sequence_order: 1,
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.data.question_text).toBe("Explain how a for-loop iterates.");
    expect(body.data.key_answer_text).toBe("A for-loop uses range directly.");
    expect(body.data.sequence_order).toBe(1);
    expect(body.data.blanks).toEqual([]);
    expect(body.data.question_id).toBeDefined();
  });

  it("should define blanks for a question successfully", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleBlanks", [
      { featureName: "lecturer_quiz_access", action: "update" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "blanks@test.com",
    });

    // Setup group, quiz and question
    const group = await prisma.group.create({
      data: { name: "Blank Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 11,
        title: "Blank Quiz",
        passThreshold: 60,
        isPublished: false,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "What is an array?",
        answerText:
          "An array is a data structure consisting of a collection of elements.",
        questionOrder: 1,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}/blanks`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blanks: [
            { keyword: "data structure", start_index: 14, end_index: 28 },
            { keyword: "elements", start_index: 59, end_index: 67 },
          ],
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.question_id).toBe(`q_${question.id}`);
    expect(body.data.blanks.length).toBe(2);
    expect(body.data.blanks[0].keyword).toBe("data structure");
    expect(body.data.blanks[0].blank_id).toBeDefined();
  });

  it("should reject blanks that do not match the key answer text", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleBlanksFail", [
      { featureName: "lecturer_quiz_access", action: "update" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "blanks2@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Blank Group 2", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 12,
        title: "Blank Quiz 2",
        passThreshold: 60,
        isPublished: false,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "What is an array?",
        answerText: "An array is a data structure.",
        questionOrder: 1,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}/blanks`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blanks: [
            { keyword: "data structure", start_index: 0, end_index: 14 }, // Incorrect indices!
          ],
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(422); // Validation Error expected
  });
});
