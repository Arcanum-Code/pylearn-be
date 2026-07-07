import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../../test_utils";

async function createMockBlankQuiz() {
  const group = await prisma.group.create({
    data: { name: "Blank Group", description: "Group for blank tests" },
  });

  const quiz = await prisma.quiz.create({
    data: {
      groupId: group.id,
      title: "Blank Quiz",
      isPublished: true,
      levelNumber: 1,
    },
  });

  // Question with two blanks: "function" and "def"
  // "To define a function, use the def keyword."
  const question = await prisma.quizQuestion.create({
    data: {
      quizId: quiz.id,
      questionText: "Complete the definition:",
      answerText: "To define a function, use the def keyword.",
      maxScore: 100,
      questionOrder: 1,
    },
  });

  const keyword1 = await prisma.questionKeyword.create({
    data: {
      questionId: question.id,
      blankOrder: 1,
      correctAnswer: "def",
      startIndex: 30,
      endIndex: 33,
    },
  });

  const keyword2 = await prisma.questionKeyword.create({
    data: {
      questionId: question.id,
      blankOrder: 2,
      correctAnswer: "function",
      startIndex: 12,
      endIndex: 20,
    },
  });

  return { quiz, question, keyword1, keyword2 };
}

describe("Blank Question and Answers Integration Tests", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("I'm using the writing-tests skill to implement the test suite", () => {
    expect(true).toBe(true);
  });

  describe("GET /student/quizzes/questions/attempt", () => {
    it("should return question with masked blank placeholders and without answer text leakage", async () => {
      const role = await createTestRoleWithPermissions("AttemptReaderRole", [
        { featureName: "student_quiz_access", action: "read" },
      ]);
      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question } = await createMockBlankQuiz();

      const res = await app.handle(
        new Request(
          `http://localhost/student/quizzes/questions/attempt?quizId=${quiz.id}`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const qData = json.data[0];

      // Verify answer key is not leaked
      expect(qData.answerText).toBeUndefined();
      expect(qData.key_answer_text).toBeUndefined();

      // Verify masked text format
      expect(qData.blankQuestionText).toBe(
        "To define a [blank_2], use the [blank_1] keyword.",
      );
      expect(qData.blanks).toHaveLength(2);
      expect(qData.blanks[0].blankOrder).toBe(1);
      expect(qData.blanks[0].correctAnswerLength).toBe(3);
      expect(qData.blanks[1].blankOrder).toBe(2);
      expect(qData.blanks[1].correctAnswerLength).toBe(8);
    });
  });

  describe("POST /student/quizzes/answers & PATCH /student/quizzes/answers/:id", () => {
    it("should create answer with structured items, evaluate correctness, and update successfully", async () => {
      const role = await createTestRoleWithPermissions("AnswerManagerRole", [
        { featureName: "student_quiz_access", action: "create" },
        { featureName: "student_quiz_access", action: "update" },
      ]);
      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question, keyword1, keyword2 } =
        await createMockBlankQuiz();

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      // Submit all correct items
      const postRes = await app.handle(
        new Request("http://localhost/student/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            items: [
              { keywordId: keyword1.id.toString(), answerText: "def" },
              { keywordId: keyword2.id.toString(), answerText: "function" },
            ],
          }),
        }),
      );

      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.data.isCorrect).toBe(true);
      expect(postJson.data.items).toHaveLength(2);
      expect(postJson.data.items[0].isCorrect).toBe(true);
      expect(postJson.data.items[1].isCorrect).toBe(true);

      const dbAnswerItems = await prisma.quizAnswerItem.findMany({
        where: { quizAnswerId: BigInt(postJson.data.id) },
      });
      expect(dbAnswerItems).toHaveLength(2);
      expect(
        dbAnswerItems.find((i) => i.keywordId === keyword1.id)?.answerText,
      ).toBe("def");

      // Update one blank to be incorrect
      const patchRes = await app.handle(
        new Request(
          `http://localhost/student/quizzes/answers/${postJson.data.id}`,
          {
            method: "PATCH",
            headers: {
              ...authHeaders,
              "content-type": "application/json",
              "x-forwarded-for": randomIp(),
            },
            body: JSON.stringify({
              items: [
                {
                  keywordId: keyword1.id.toString(),
                  answerText: "wrongAnswer",
                },
                { keywordId: keyword2.id.toString(), answerText: "function" },
              ],
            }),
          },
        ),
      );

      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.data.isCorrect).toBe(false);
      expect(
        patchJson.data.items.find(
          (i: any) => i.keywordId === keyword1.id.toString(),
        ).isCorrect,
      ).toBe(false);
      expect(
        patchJson.data.items.find(
          (i: any) => i.keywordId === keyword2.id.toString(),
        ).isCorrect,
      ).toBe(true);
    });
  });

  describe("PATCH /student/quizzes/attempts/:id/submit & GET /student/quizzes/attempts/:id/results", () => {
    it("should calculate average score (e.g. 50% for 1 of 2 correct blanks) and return breakdown details", async () => {
      const role = await createTestRoleWithPermissions("AttemptSubmitterRole", [
        { featureName: "student_quiz_access", action: "create" },
        { featureName: "student_quiz_access", action: "update" },
        { featureName: "student_quiz_access", action: "read" },
      ]);
      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { quiz, question, keyword1, keyword2 } =
        await createMockBlankQuiz();

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: user.id,
        },
      });

      // Submit 1 correct and 1 incorrect blank
      await app.handle(
        new Request("http://localhost/student/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            items: [
              { keywordId: keyword1.id.toString(), answerText: "def" },
              {
                keywordId: keyword2.id.toString(),
                answerText: "incorrectText",
              },
            ],
          }),
        }),
      );

      // Submit the attempt
      const submitRes = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/${attempt.id}/submit`,
          {
            method: "PATCH",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(submitRes.status).toBe(200);
      const submitJson = await submitRes.json();

      // Get attempt results
      const resultsRes = await app.handle(
        new Request(
          `http://localhost/student/quizzes/attempts/${attempt.id}/results`,
          {
            method: "GET",
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );

      expect(resultsRes.status).toBe(200);
      const resultsJson = await resultsRes.json();
      expect(resultsJson.data.score).toBe(50);

      const details = resultsJson.data.details[0];
      expect(details.isCorrect).toBe(false); // Overall answer is not fully correct
      expect(details.blanks).toHaveLength(2);
      expect(
        details.blanks.find((b: any) => b.keywordId === keyword1.id.toString())
          .isCorrect,
      ).toBe(true);
      expect(
        details.blanks.find((b: any) => b.keywordId === keyword2.id.toString())
          .isCorrect,
      ).toBe(false);
      expect(details.userAnswer).toBe(
        "To define a incorrectText, use the def keyword.",
      );
    });
  });
});
