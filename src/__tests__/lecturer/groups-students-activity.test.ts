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

  it("should return matrix and drill-down details with question breakdowns for student", async () => {
    const role = await createTestRoleWithPermissions("LecturerRole", [
      { featureName: "group_management", action: "read" },
    ]);

    const { authHeaders, user: lecturer } = await createAuthenticatedUser({
      roleId: role.id,
      email: "dosen@test.com",
    });

    const studentRole = await prisma.role.upsert({
      where: { name: "Mahasiswa" },
      update: {},
      create: { name: "Mahasiswa", description: "Student Role" },
    });

    // Create a student user
    const student = await prisma.user.create({
      data: {
        email: "budi@test.com",
        name: "Budi Santoso",
        password: "hash",
        roleId: studentRole.id,
      },
    });

    // Create group, materials, quizzes, fill-in-the-blank questions
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
          ],
        },
        quizzes: {
          create: [
            {
              title: "Quiz 1",
              levelNumber: 1,
              passThreshold: 70,
              questions: {
                create: [
                  {
                    questionText: "Lengkapi kode berikut: ___ = 5",
                    answerText: "x = 5",
                    maxScore: 100,
                    questionOrder: 1,
                    keywords: {
                      create: [
                        {
                          blankOrder: 1,
                          correctAnswer: "x",
                          startIndex: 0,
                          endIndex: 1,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        materials: true,
        quizzes: {
          include: {
            questions: {
              include: { keywords: true },
            },
          },
        },
      },
    });

    const mat1 = group.materials[0];
    const quiz1 = group.quizzes[0];
    const question1 = quiz1.questions[0];
    const keyword1 = question1.keywords[0];

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

    // Create QuizAttempt for quiz1 along with QuizAnswer and QuizAnswerItem (blank answer)
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz1.id,
        studentId: student.id,
        attemptNumber: 1,
        score: 100,
        startedAt: new Date(Date.now() - 10000),
        submittedAt: new Date(),
        answers: {
          create: [
            {
              quizQuestionId: question1.id,
              answerText: "",
              isCorrect: true,
              items: {
                create: [
                  {
                    keywordId: keyword1.id,
                    answerText: "x",
                    isCorrect: true,
                  },
                ],
              },
            },
          ],
        },
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

    const attemptHistory = detailBody.data.quiz_attempts_history[0];
    expect(attemptHistory.score).toBe(100);
    expect(attemptHistory.questions).toBeDefined();
    expect(attemptHistory.questions).toHaveLength(1);

    const qItem = attemptHistory.questions[0];
    expect(qItem.question_id).toBe(String(question1.id));
    expect(qItem.question_text).toBe("Lengkapi kode berikut: ___ = 5");
    expect(qItem.question_type).toBe("SHORT_ANSWER");
    expect(qItem.student_answer).toBe("x = 5"); // Successfully reconstructed from QuizAnswerItem!
    expect(qItem.correct_answer).toBe("x = 5");
    expect(qItem.is_correct).toBe(true);
    expect(qItem.points_earned).toBe(100);
    expect(qItem.points_possible).toBe(100);
    expect(qItem.explanation).toBe(null);
  });
});
