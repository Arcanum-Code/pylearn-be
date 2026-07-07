import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";

describe("Lecturer Quiz API - Questions & Blanks", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should add a new question to a quiz", async () => {
    const role = await createTestRoleWithPermissions("LecturerRoleQuestion", [
      { featureName: "lecturer_quiz_access", action: "update" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "question@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Question Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 10,
        title: "Question Quiz",
        passThreshold: 60,
        publishedAt: null,
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

    const group = await prisma.group.create({
      data: { name: "Blank Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 11,
        title: "Blank Quiz",
        passThreshold: 60,
        publishedAt: null,
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
        publishedAt: null,
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
            { keyword: "data structure", start_index: 0, end_index: 14 },
          ],
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(422);
  });

  it("should update a question and return blanks_invalidated if key answer changes invalidly", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePatchQuestion",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "patch_q@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Patch Q Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 13,
        title: "Patch Q Quiz",
        passThreshold: 60,
        publishedAt: null,
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
    await prisma.questionKeyword.create({
      data: {
        questionId: question.id,
        blankOrder: 1,
        correctAnswer: "data structure",
        startIndex: 14,
        endIndex: 28,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_text: "What exactly is an array?",
          key_answer_text: "An array represents a data structure.",
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.question_text).toBe("What exactly is an array?");
    expect(body.data.key_answer_text).toBe(
      "An array represents a data structure.",
    );
    expect(body.data.blanks_invalidated).toBe(true);
    expect(body.data.message).toBe(
      "Key answer changed; please re-select blanks.",
    );
  });

  it("should delete a question and cascade delete its blanks", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRoleDeleteQuestion",
      [{ featureName: "lecturer_quiz_access", action: "delete" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "del_q@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Delete Q Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 14,
        title: "Delete Q Quiz",
        passThreshold: 60,
        publishedAt: null,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "To be deleted?",
        answerText: "Yes.",
        questionOrder: 1,
      },
    });
    const blank = await prisma.questionKeyword.create({
      data: {
        questionId: question.id,
        blankOrder: 1,
        correctAnswer: "Yes",
        startIndex: 0,
        endIndex: 3,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(204);

    const deletedQuestion = await prisma.quizQuestion.findUnique({
      where: { id: question.id },
    });
    expect(deletedQuestion).toBeNull();

    const deletedBlank = await prisma.questionKeyword.findUnique({
      where: { id: blank.id },
    });
    expect(deletedBlank).toBeNull();
  });
});
