import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";

import {
  resetDatabase,
  createAuthenticatedUser,
  createTestMaterial,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

// =========================================================================
// Helpers
// =========================================================================
async function createMockQuestion(userId: string) {
  const material = await createTestMaterial(userId);

  const quiz = await prisma.quiz.create({
    data: {
      materialId: material.id,
      title: "Answer Quiz",
      isPublished: true,
    },
  });

  const level = await prisma.quizLevel.create({
    data: {
      quizId: quiz.id,
      title: "Level 1",
      levelOrder: 1,
    },
  });

  const question = await prisma.quizQuestion.create({
    data: {
      quizLevelId: level.id,
      questionText: "What is OOP?",
      answerText: "Object Oriented Programming",
      maxScore: 100,
      questionOrder: 1,
    },
  });

  return {
    quiz,
    level,
    question,
  };
}

// =========================================================================
// Main Quiz Answers Test Suite
// =========================================================================
describe("Quiz Answers Management Integration Tests", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =======================================================================
  // POST /quizzes/answers
  // =======================================================================
  describe("POST /quizzes/answers", () => {
    it("should create correct answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "quiz_management", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText: "Object Oriented Programming",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.quizAttemptId).toBe(attempt.id.toString());
      expect(json.data.quizQuestionId).toBe(question.id.toString());
    });

    it("should strip out HTML rich text markup tags and match correctly", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "quiz_management", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            // Mimic typical output from WYSIWYG editors (TinyMCE, CKEditor, Quill)
            answerText:
              "<p>  Object Oriented <strong>Programming</strong>&nbsp;</p>",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();

      // Verification rules: tags removed, space entities unrolled, match succeeds
      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe(
        "<p>  Object Oriented <strong>Programming</strong>&nbsp;</p>",
      );
    });

    it("should create incorrect answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerCreatorRole", [
        { featureName: "quiz_management", action: "create" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText: "Wrong Answer",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.isCorrect).toBe(false);
    });

    it("should reject without permission", async () => {
      const role = await createTestRoleWithPermissions("AnswerReaderRole", [
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers", {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            quizAttemptId: attempt.id.toString(),
            quizQuestionId: question.id.toString(),
            answerText: "Object Oriented Programming",
          }),
        }),
      );

      expect(res.status).toBe(403);
    });
  });

  // =======================================================================
  // GET /quizzes/answers
  // =======================================================================
  describe("GET /quizzes/answers", () => {
    it("should return answers", async () => {
      const role = await createTestRoleWithPermissions("AnswerReaderRole", [
        { featureName: "quiz_management", action: "read" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "Object Oriented Programming",
          isCorrect: true,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/quizzes/answers?quizAttemptId=${attempt.id}`,
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
      expect(json.data).toHaveLength(1);
      expect(json.data[0].isCorrect).toBe(true);
    });
  });

  // =======================================================================
  // PATCH /quizzes/answers/:id
  // =======================================================================
  describe("PATCH /quizzes/answers/:id", () => {
    it("should update answer and evaluate accuracy logic automatically", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "quiz_management", action: "update" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const answer = await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "Wrong Initial Answer",
          isCorrect: false,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/answers/${answer.id}`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            answerText: "Object Oriented Programming",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe("Object Oriented Programming");
    });

    // 🧪 NEW: HTML rich text evaluation on update action paths
    it("should strip out HTML markup tags during update modifications and grade accurately", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "quiz_management", action: "update" },
      ]);

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const answer = await prisma.quizAnswer.create({
        data: {
          quizAttemptId: attempt.id,
          quizQuestionId: question.id,
          answerText: "Wrong Initial Answer",
          isCorrect: false,
        },
      });

      const res = await app.handle(
        new Request(`http://localhost/quizzes/answers/${answer.id}`, {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            answerText: "<div>\nObject Oriented Programming\n</div>",
          }),
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.isCorrect).toBe(true);
      expect(json.data.answerText).toBe(
        "<div>\nObject Oriented Programming\n</div>",
      );
    });

    it("should return 404 for non-existent answer", async () => {
      const role = await createTestRoleWithPermissions("AnswerUpdaterRole", [
        { featureName: "quiz_management", action: "update" },
      ]);

      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const res = await app.handle(
        new Request("http://localhost/quizzes/answers/999999", {
          method: "PATCH",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            answerText: "Updated Answer",
          }),
        }),
      );

      expect(res.status).toBe(404);
    });
  });

  // =======================================================================
  // POST /quizzes/answers/bulk
  // =======================================================================
  describe("POST /quizzes/answers/bulk", () => {
    it("should process and grade a batch of quiz answers successfully", async () => {
      const role = await createTestRoleWithPermissions(
        "BulkAnswerCreatorRole",
        [{ featureName: "quiz_management", action: "create" }],
      );

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question: q1 } = await createMockQuestion(user.id);

      // Create a second question on the same level to test true bulk handling
      const q2 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "What does HTML stand for?",
          answerText: "HyperText Markup Language",
          maxScore: 100,
          questionOrder: 2,
        },
      });

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const payload = {
        quizAttemptId: attempt.id.toString(),
        quizLevelId: level.id.toString(),
        answers: [
          {
            quizQuestionId: q1.id.toString(),
            answerText: "Object Oriented Programming", // Correct
          },
          {
            quizQuestionId: q2.id.toString(),
            answerText: "Wrong Answer Choice", // Incorrect
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

      // Verify Question 1 was graded correctly
      const answer1 = json.data.find(
        (a: any) => a.quizQuestionId === q1.id.toString(),
      );
      expect(answer1.isCorrect).toBe(true);
      expect(answer1.answerText).toBe("Object Oriented Programming");

      // Verify Question 2 was graded incorrectly
      const answer2 = json.data.find(
        (a: any) => a.quizQuestionId === q2.id.toString(),
      );
      expect(answer2.isCorrect).toBe(false);
      expect(answer2.answerText).toBe("Wrong Answer Choice");
    });

    it("should successfully sanitize HTML rich-text entries across bulk submissions", async () => {
      const role = await createTestRoleWithPermissions(
        "BulkAnswerCreatorRole",
        [{ featureName: "quiz_management", action: "create" }],
      );

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level, question } = await createMockQuestion(user.id);

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const payload = {
        quizAttemptId: attempt.id.toString(),
        quizLevelId: level.id.toString(),
        answers: [
          {
            quizQuestionId: question.id.toString(),
            // Rich text variations with tags and entities mixed in
            answerText:
              "<p><strong>Object Oriented</strong> Programming&nbsp;</p>",
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

      expect(json.data[0].isCorrect).toBe(true);
      expect(json.data[0].answerText).toBe(
        "<p><strong>Object Oriented</strong> Programming&nbsp;</p>",
      );
    });

    it("should reject 400 bad request if a question does not belong to the target quiz level", async () => {
      const role = await createTestRoleWithPermissions(
        "BulkAnswerCreatorRole",
        [{ featureName: "quiz_management", action: "create" }],
      );

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });
      const { level } = await createMockQuestion(user.id);

      // Create an outside question linked to an entirely different quiz group context
      const alternativeMaterial = await prisma.material.create({
        data: {
          title: "Alternative Material",
          materialType: "text",
          lecturerId: user.id,
        },
      });
      const alternativeQuiz = await prisma.quiz.create({
        data: {
          materialId: alternativeMaterial.id,
          title: "Alt Quiz",
          isPublished: true,
        },
      });
      const alternativeLevel = await prisma.quizLevel.create({
        data: { quizId: alternativeQuiz.id, title: "Alt Level", levelOrder: 1 },
      });
      const rogueQuestion = await prisma.quizQuestion.create({
        data: {
          quizLevelId: alternativeLevel.id,
          questionText: "Rogue Question?",
          answerText: "Catch me if you can",
          questionOrder: 1,
        },
      });

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      const payload = {
        quizAttemptId: attempt.id.toString(),
        quizLevelId: level.id.toString(), // Current Level Context
        answers: [
          {
            quizQuestionId: rogueQuestion.id.toString(), // Rogue Question Context Boundary Violation
            answerText: "Catch me if you can",
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

      // Triggers custom domain rule context exceptions
      expect(res.status).toBe(400);
    });

    it("should correctly evaluate answers when the database answer key contains complex HTML tags (p, br, a, li)", async () => {
      const role = await createTestRoleWithPermissions(
        "BulkAnswerCreatorRole",
        [{ featureName: "quiz_management", action: "create" }],
      );

      const { user, authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      // 1. Setup isolated material and level for this specific test
      const material = await createTestMaterial(user.id);
      const quiz = await prisma.quiz.create({
        data: {
          materialId: material.id,
          title: "HTML Key Quiz",
          isPublished: true,
        },
      });
      const level = await prisma.quizLevel.create({
        data: { quizId: quiz.id, title: "Level 1", levelOrder: 1 },
      });

      // 2. Create questions with complex HTML in the 'answerText' field

      // Question 1: Code snippet using <p> and <br>
      const q1 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "Write a simple Python script.",
          answerText: "<p>x = 5<br>y = 3<br>hasil = x + y<br>print(hasil)</p>",
          maxScore: 33,
          questionOrder: 1,
        },
      });

      // Question 2: List elements using <ul> and <li>
      const q2 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "List the core web technologies.",
          answerText: "<ul><li>HTML</li><li>CSS</li><li>JavaScript</li></ul>",
          maxScore: 33,
          questionOrder: 2,
        },
      });

      // Question 3: Inline styling and links using <a> and <strong>
      const q3 = await prisma.quizQuestion.create({
        data: {
          quizLevelId: level.id,
          questionText: "How do you link a URL?",
          answerText:
            'Use the <a href="https://example.com"><strong>anchor</strong> tag</a>.',
          maxScore: 34,
          questionOrder: 3,
        },
      });

      const attempt = await prisma.quizAttempt.create({
        data: {
          quizLevelId: level.id,
          studentId: user.id,
        },
      });

      // 3. User submits their answers
      const payload = {
        quizAttemptId: attempt.id.toString(),
        quizLevelId: level.id.toString(),
        answers: [
          {
            // User answers with pure plain text (simulating typed input)
            quizQuestionId: q1.id.toString(),
            answerText: "x = 5 y = 3 hasil = x + y print(hasil)",
          },
          {
            quizQuestionId: q2.id.toString(),
            answerText: "HTML CSS JavaScript",
          },
          {
            // User answers with pure plain text and extra spaces
            quizQuestionId: q3.id.toString(),
            answerText: "Use the anchor tag .", // Your punctuation spacing fallback handles this!
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

      expect(json.data).toHaveLength(3);

      // Verify Question 1 (The <br> tags were safely converted to spaces and matched)
      const a1 = json.data.find(
        (a: any) => a.quizQuestionId === q1.id.toString(),
      );
      expect(a1.isCorrect).toBe(true);

      // Verify Question 2 (The <li> tags were stripped and matched)
      const a2 = json.data.find(
        (a: any) => a.quizQuestionId === q2.id.toString(),
      );
      expect(a2.isCorrect).toBe(true);

      // Verify Question 3 (The <a> and <strong> tags were stripped and matched)
      const a3 = json.data.find(
        (a: any) => a.quizQuestionId === q3.id.toString(),
      );
      expect(a3.isCorrect).toBe(true);
    });
  });
});
