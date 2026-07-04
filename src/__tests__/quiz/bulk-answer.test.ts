import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestMaterial,
  randomIp,
  resetDatabase,
} from "../test_utils";

// =========================================
// Helpers
// =========================================
async function setupQuizHierarchy(lecturerId: string) {
  const material = await createTestMaterial(lecturerId);

  const quiz = await prisma.quiz.create({
    data: {
      materialId: material.id,
      title: "Bulk Operations Quiz",
      isPublished: true,
    },
  });

  const level = await prisma.quizLevel.create({
    data: {
      quizId: quiz.id,
      title: "Syntax Level",
      levelOrder: 1,
    },
  });

  const question1 = await prisma.quizQuestion.create({
    data: {
      quizLevelId: level.id,
      questionText: "What does HTML stand for?",
      answerText: "HyperText Markup Language",
      maxScore: 10,
      questionOrder: 1,
    },
  });

  const question2 = await prisma.quizQuestion.create({
    data: {
      quizLevelId: level.id,
      questionText: "What does CSS stand for?",
      answerText: "Cascading Style Sheets",
      maxScore: 10,
      questionOrder: 2,
    },
  });

  return { quiz, level, question1, question2 };
}

// =========================================
// POST /quizzes/answers/bulk
// =========================================
describe("POST /quizzes/answers/bulk", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should process bulk answers and evaluate correctness accurately", async () => {
    const role = await createTestRoleWithPermissions("BulkAnswerSubmitter", [
      { featureName: "quiz_management", action: "create" },
    ]);

    const { user: student, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const { quiz, level, question1, question2 } = await setupQuizHierarchy(
      student.id,
    );

    // Create an open target attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizLevelId: level.id,
        studentId: student.id,
        submittedAt: null,
      },
    });

    const payload = {
      quizAttemptId: attempt.id.toString(),
      quizId: quiz.id.toString(),
      quizLevelId: level.id.toString(),
      answers: [
        {
          quizQuestionId: question1.id.toString(),
          answerText: "HyperText Markup Language", // Correct answer
        },
        {
          quizQuestionId: question2.id.toString(),
          answerText: "Wrong Answer Text", // Incorrect answer
        },
      ],
    };

    const res = await app.handle(
      new Request("http://localhost/quizzes/answers/bulk", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.data).toHaveLength(2);

    // Validate correct evaluation handling
    const ans1 = json.data.find(
      (a: any) => a.quizQuestionId === question1.id.toString(),
    );
    const ans2 = json.data.find(
      (a: any) => a.quizQuestionId === question2.id.toString(),
    );

    expect(ans1.isCorrect).toBe(true);
    expect(ans2.isCorrect).toBe(false);

    // Verify row count generation inside physical database table
    const dbRowsCount = await prisma.quizAnswer.count({
      where: { quizAttemptId: attempt.id },
    });
    expect(dbRowsCount).toBe(2);
  });

  it("should reject submission if the quiz attempt is already submitted/closed", async () => {
    const role = await createTestRoleWithPermissions("BulkAnswerSubmitter", [
      { featureName: "quiz_management", action: "create" },
    ]);

    const { user: student, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const { quiz, level, question1 } = await setupQuizHierarchy(student.id);

    // Create a closed attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizLevelId: level.id,
        studentId: student.id,
        submittedAt: new Date(), // Already submitted status
      },
    });

    const payload = {
      quizAttemptId: attempt.id.toString(),
      quizId: quiz.id.toString(),
      quizLevelId: level.id.toString(),
      answers: [
        {
          quizQuestionId: question1.id.toString(),
          answerText: "Some Answer",
        },
      ],
    };

    const res = await app.handle(
      new Request("http://localhost/quizzes/answers/bulk", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    // Should return 400 Bad Request or 404 depending on your global error implementation
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("should reject if a question does not belong to the targeted quiz level context", async () => {
    const role = await createTestRoleWithPermissions("BulkAnswerSubmitter", [
      { featureName: "quiz_management", action: "create" },
    ]);

    const { user: student, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const { quiz, level } = await setupQuizHierarchy(student.id);

    // Create another unrelated quiz level and question
    const rogueLevel = await prisma.quizLevel.create({
      data: { quizId: quiz.id, title: "Rogue Level", levelOrder: 2 },
    });
    const rogueQuestion = await prisma.quizQuestion.create({
      data: {
        quizLevelId: rogueLevel.id,
        questionText: "Rogue Question?",
        answerText: "Secret",
        maxScore: 5,
        questionOrder: 1,
      },
    });

    const attempt = await prisma.quizAttempt.create({
      data: { quizLevelId: level.id, studentId: student.id, submittedAt: null },
    });

    const payload = {
      quizAttemptId: attempt.id.toString(),
      quizId: quiz.id.toString(),
      quizLevelId: level.id.toString(), // Targeting first level
      answers: [
        {
          quizQuestionId: rogueQuestion.id.toString(), // Injection test: Question belongs to level 2!
          answerText: "Malicious Attempt Data",
        },
      ],
    };

    const res = await app.handle(
      new Request("http://localhost/quizzes/answers/bulk", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    // Confirm that transaction successfully rolled back and no answers were stored
    const answerCount = await prisma.quizAnswer.count({
      where: { quizAttemptId: attempt.id },
    });
    expect(answerCount).toBe(0);
  });
});
