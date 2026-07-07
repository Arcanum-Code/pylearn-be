import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  resetDatabase,
} from "../../test_utils";

async function setupQuizHierarchy(lecturerId: string) {
  const group = await prisma.group.create({
    data: { name: "Default Group", description: "Default group for tests" },
  });

  const quiz = await prisma.quiz.create({
    data: {
      groupId: group.id,
      title: "Bulk Operations Quiz",
      isPublished: true,
      levelNumber: 1,
    },
  });

  const question1 = await prisma.quizQuestion.create({
    data: {
      quizId: quiz.id,
      questionText: "What does HTML stand for?",
      answerText: "HyperText Markup Language",
      maxScore: 10,
      questionOrder: 1,
    },
  });

  const question2 = await prisma.quizQuestion.create({
    data: {
      quizId: quiz.id,
      questionText: "What does CSS stand for?",
      answerText: "Cascading Style Sheets",
      maxScore: 10,
      questionOrder: 2,
    },
  });

  return { quiz, question1, question2, group };
}

describe("POST /quizzes/answers/bulk", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should process bulk answers and evaluate correctness accurately", async () => {
    const role = await createTestRoleWithPermissions("BulkAnswerSubmitter", [
      { featureName: "student_quiz_access", action: "create" },
    ]);

    const { user: student, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const { quiz, question1, question2 } = await setupQuizHierarchy(student.id);

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        submittedAt: null,
      },
    });

    const payload = {
      quizAttemptId: attempt.id.toString(),
      quizId: quiz.id.toString(),
      answers: [
        {
          quizQuestionId: question1.id.toString(),
          answerText: "HyperText Markup Language",
        },
        {
          quizQuestionId: question2.id.toString(),
          answerText: "Wrong Answer Text",
        },
      ],
    };

    const res = await app.handle(
      new Request("http://localhost/student/quizzes/answers/bulk", {
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

    const ans1 = json.data.find(
      (a: any) => a.quizQuestionId === question1.id.toString(),
    );
    const ans2 = json.data.find(
      (a: any) => a.quizQuestionId === question2.id.toString(),
    );

    expect(ans1.isCorrect).toBe(true);
    expect(ans2.isCorrect).toBe(false);

    const dbRowsCount = await prisma.quizAnswer.count({
      where: { quizAttemptId: attempt.id },
    });
    expect(dbRowsCount).toBe(2);
  });

  it("should reject submission if the quiz attempt is already submitted/closed", async () => {
    const role = await createTestRoleWithPermissions("BulkAnswerSubmitter", [
      { featureName: "student_quiz_access", action: "create" },
    ]);

    const { user: student, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const { quiz, question1 } = await setupQuizHierarchy(student.id);

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        submittedAt: new Date(),
      },
    });

    const payload = {
      quizAttemptId: attempt.id.toString(),
      quizId: quiz.id.toString(),
      answers: [
        {
          quizQuestionId: question1.id.toString(),
          answerText: "Some Answer",
        },
      ],
    };

    const res = await app.handle(
      new Request("http://localhost/student/quizzes/answers/bulk", {
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
  });

  it("should reject if a question does not belong to the targeted quiz context", async () => {
    const role = await createTestRoleWithPermissions("BulkAnswerSubmitter", [
      { featureName: "student_quiz_access", action: "create" },
    ]);

    const { user: student, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const { quiz, question1, group } = await setupQuizHierarchy(student.id);

    const rogueQuiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        title: "Rogue Quiz",
        levelNumber: 2,
        isPublished: true,
      },
    });

    const rogueQuestion = await prisma.quizQuestion.create({
      data: {
        quizId: rogueQuiz.id,
        questionText: "Rogue Question?",
        answerText: "Secret",
        maxScore: 5,
        questionOrder: 1,
      },
    });

    const attempt = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: student.id, submittedAt: null },
    });

    const payload = {
      quizAttemptId: attempt.id.toString(),
      quizId: quiz.id.toString(),
      answers: [
        {
          quizQuestionId: rogueQuestion.id.toString(),
          answerText: "Malicious Attempt Data",
        },
      ],
    };

    const res = await app.handle(
      new Request("http://localhost/student/quizzes/answers/bulk", {
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

    const answerCount = await prisma.quizAnswer.count({
      where: { quizAttemptId: attempt.id },
    });
    expect(answerCount).toBe(0);
  });
});
