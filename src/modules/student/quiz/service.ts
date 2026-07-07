import { prisma } from "@/libs/prisma";
import type { Logger } from "pino";
import type {
  CreateQuizAttemptInput,
  CreateQuizAnswerInput,
  UpdateQuizAnswerInput,
  CreateBulkQuizAnswerInput,
} from "./schema";
import {
  QuizAttemptContextException,
  QuizAttemptValidationError,
} from "./error";
import { Prisma } from "@generated/prisma";

// ─────────────────────────────────────────────
// Prisma Select Shapes
// ─────────────────────────────────────────────

const ATTEMPT_SELECT = {
  id: true,
  quizId: true,
  studentId: true,
  startedAt: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  quiz: {
    select: {
      id: true,
      title: true,
      levelNumber: true,
    },
  },
  student: { select: { name: true } },
} as const;

const ANSWER_SELECT = {
  id: true,
  quizAttemptId: true,
  quizQuestionId: true,
  answerText: true,
  isCorrect: true,
  answeredAt: true,
  createdAt: true,
  updatedAt: true,
  quizQuestion: { select: { questionText: true } },
} as const;

export const STUDENT_QUESTION_SELECT = {
  id: true,
  quizId: true,
  questionText: true,
  maxScore: true,
  questionOrder: true,
} as const;

// ─────────────────────────────────────────────
// Mappers: DB record → API response shape
// ─────────────────────────────────────────────

type AttemptRecord = Prisma.QuizAttemptGetPayload<{
  select: typeof ATTEMPT_SELECT;
}>;
type AnswerRecord = Prisma.QuizAnswerGetPayload<{
  select: typeof ANSWER_SELECT;
}>;

function mapAttempt(attempt: AttemptRecord) {
  return {
    id: attempt.id.toString(),
    quizId: attempt.quizId.toString(),
    quizTitle: attempt.quiz.title,
    studentId: attempt.studentId,
    studentName: attempt.student.name,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  };
}

function mapAnswer(answer: AnswerRecord) {
  return {
    id: answer.id.toString(),
    quizAttemptId: answer.quizAttemptId.toString(),
    quizQuestionId: answer.quizQuestionId.toString(),
    questionText: answer.quizQuestion.questionText,
    answerText: answer.answerText,
    isCorrect: answer.isCorrect,
    answeredAt: answer.answeredAt.toISOString(),
    createdAt: answer.createdAt.toISOString(),
    updatedAt: answer.updatedAt.toISOString(),
  };
}

function normalizeAnswer(text: string): string {
  return text
    .replace(/<\/?(br|p|div|tr|td|li|ul|ol|h[1-6])\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;\s])/g, "$1")
    .trim()
    .toLowerCase();
}

// ─────────────────────────────────────────────
// Student Quiz Service
// ─────────────────────────────────────────────

export abstract class StudentQuizService {
  static async getAttempts(
    quizId: bigint | undefined,
    studentId: string | undefined,
    log: Logger,
  ) {
    log.debug(
      { quizId: quizId?.toString(), studentId },
      "Fetching student attempts",
    );

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        ...(quizId && { quizId }),
        ...(studentId && { studentId }),
      },
      select: ATTEMPT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    log.info({ count: attempts.length }, "Student attempts retrieved");
    return attempts.map(mapAttempt);
  }

  static async getAttempt(attemptId: bigint, log: Logger) {
    log.debug({ attemptId: attemptId.toString() }, "Fetching student attempt");

    const attempt = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { ...ATTEMPT_SELECT, answers: { select: ANSWER_SELECT } },
    });

    log.info({ attemptId: attempt.id.toString() }, "Student attempt retrieved");
    return { ...mapAttempt(attempt), answers: attempt.answers.map(mapAnswer) };
  }

  static async getProgress(quizId: bigint, studentId: string, log: Logger) {
    log.debug(
      { quizId: quizId.toString(), studentId },
      "Fetching student direct quiz progress",
    );

    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: { groupId: true },
    });

    const quizzes = await prisma.quiz.findMany({
      where: { groupId: quiz.groupId },
      orderBy: { levelNumber: "asc" },
      select: {
        id: true,
        title: true,
        levelNumber: true,
        _count: { select: { questions: true } },
      },
    });

    const quizIds = quizzes.map((q) => q.id);

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId: { in: quizIds },
        studentId: studentId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quizId: true,
        submittedAt: true,
        createdAt: true,
      },
    });

    const progress = quizzes.map((q) => {
      const latestAttempt = attempts.find((a) => a.quizId === q.id);

      let status = "NOT_STARTED";
      let currentAttemptId: string | null = null;

      if (latestAttempt) {
        currentAttemptId = latestAttempt.id.toString();
        status = latestAttempt.submittedAt ? "COMPLETED" : "IN_PROGRESS";
      }

      return {
        quizId: q.id.toString(),
        title: q.title,
        levelNumber: q.levelNumber,
        status: status,
        currentAttemptId: currentAttemptId,
        totalQuestions: q._count.questions,
      };
    });

    log.info(
      {
        studentId,
        groupId: quiz.groupId,
        totalQuizzesMapped: quizzes.length,
      },
      "Group quiz progress compiled successfully",
    );

    return {
      groupId: quiz.groupId,
      progress,
      attemptHistory: attempts.map((a) => ({
        id: a.id.toString(),
        submittedAt: a.submittedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  static async createAttempt(
    studentId: string,
    data: CreateQuizAttemptInput,
    log: Logger,
  ) {
    const quizId = BigInt(data.quizId);
    log.debug(
      { quizId: quizId.toString(), studentId },
      "Creating student quiz attempt",
    );

    // Fetch Quiz
    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
    });

    // 🛡️ Gate 2: Level Prerequisite Check (Must pass levelNumber - 1)
    if (quiz.levelNumber > 1) {
      const prevQuiz = await prisma.quiz.findFirst({
        where: {
          groupId: quiz.groupId,
          levelNumber: quiz.levelNumber - 1,
        },
      });

      if (prevQuiz) {
        const prevAttempts = await prisma.quizAttempt.findMany({
          where: {
            quizId: prevQuiz.id,
            studentId,
            submittedAt: { not: null },
          },
          orderBy: { score: "desc" },
          take: 1,
        });

        const passed =
          prevAttempts.length > 0 &&
          prevAttempts[0].score !== null &&
          prevAttempts[0].score >= prevQuiz.passThreshold;

        if (!passed) {
          throw new QuizAttemptValidationError(
            `You must pass Quiz Level ${quiz.levelNumber - 1} before attempting this level.`,
          );
        }
      }
    }

    // 🛑 DEFENSIVE GUARD: Prevent duplicate active attempts
    const active = await prisma.quizAttempt.findFirst({
      where: {
        studentId,
        quizId,
        submittedAt: null,
      },
    });

    if (active) {
      throw new QuizAttemptValidationError(
        "You already have an active session for this quiz. Please submit it first.",
      );
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        studentId,
      },
      select: ATTEMPT_SELECT,
    });

    log.info(
      { attemptId: attempt.id.toString() },
      "Quiz attempt session instantiated successfully",
    );
    return mapAttempt(attempt);
  }

  static async submitAttempt(
    attemptId: bigint,
    studentId: string,
    log: Logger,
  ) {
    log.debug(
      { attemptId, studentId },
      "Submitting and grading student quiz attempt",
    );

    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        studentId: studentId,
        submittedAt: null,
      },
      include: {
        quiz: {
          select: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (!attempt) {
      log.warn(
        { attemptId, studentId },
        "Submit failed: Attempt not found or already submitted",
      );
      throw new QuizAttemptContextException(
        "This attempt is either invalid or has already been submitted.",
      );
    }

    const totalQuestions = attempt.quiz._count.questions;

    const correctAnswers = await prisma.quizAnswer.findMany({
      where: {
        quizAttemptId: attemptId,
        isCorrect: true,
      },
      select: {
        quizQuestion: {
          select: { maxScore: true },
        },
      },
    });

    const allScore = correctAnswers.reduce(
      (sum, ans) => sum + ans.quizQuestion.maxScore,
      0,
    );
    const finalScore = totalQuestions > 0 ? allScore / totalQuestions : 0;

    const finalizedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        score: finalScore,
      },
      select: ATTEMPT_SELECT,
    });

    log.info(
      { attemptId, score: finalScore, totalQuestions },
      "Attempt submitted and graded successfully",
    );

    return mapAttempt(finalizedAttempt);
  }

  static async getAllAttemptsResults(
    filters: { quizId?: string; studentId?: string },
    log: Logger,
  ) {
    log.debug(
      { filters },
      "Fetching bulk quiz attempts results summary for students",
    );

    const whereClause: Prisma.QuizAttemptWhereInput = {};
    if (filters.quizId) {
      whereClause.quizId = BigInt(filters.quizId);
    }
    if (filters.studentId) {
      whereClause.studentId = filters.studentId;
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: whereClause,
      include: {
        quiz: {
          select: {
            title: true,
            levelNumber: true,
            _count: { select: { questions: true } },
          },
        },
        student: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return attempts.map((a) => ({
      attemptId: a.id.toString(),
      quizId: a.quizId.toString(),
      quizTitle: a.quiz.title,
      levelNumber: a.quiz.levelNumber,
      studentId: a.studentId,
      studentName: a.student.name,
      studentEmail: a.student.email,
      score: a.score,
      totalQuestions: a.quiz._count.questions,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
    }));
  }

  static async getAttemptResults(
    attemptId: string,
    ctx: { userId: string; userRole: string },
    log: Logger,
  ) {
    const id = BigInt(attemptId);
    log.debug(
      { attemptId, user: ctx.userId, role: ctx.userRole },
      "Fetching detailed student quiz attempt results",
    );

    const isPrivilegedRole =
      ctx.userRole === "SuperAdmin" || ctx.userRole === "Dosen";

    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        id: id,
        ...(isPrivilegedRole ? {} : { studentId: ctx.userId }),
      },
      include: {
        quiz: {
          include: {
            questions: { orderBy: { questionOrder: "asc" } },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      log.warn(
        { attemptId, userId: ctx.userId, role: ctx.userRole },
        "Student result fetch blocked",
      );
      throw new QuizAttemptContextException(
        "Attempt not found or you do not have permission to view it.",
      );
    }

    if (!attempt.submittedAt) {
      throw new QuizAttemptValidationError(
        "Cannot view detailed results for an unsubmitted attempt. Please submit the quiz first.",
      );
    }

    const details = attempt.quiz.questions.map((question) => {
      const userAnswerRecord = attempt.answers.find(
        (a) => a.quizQuestionId === question.id,
      );

      return {
        questionId: question.id.toString(),
        questionText: question.questionText,
        maxScore: question.maxScore,
        userAnswer: userAnswerRecord?.answerText ?? null,
        correctAnswer: question.answerText,
        isCorrect: userAnswerRecord?.isCorrect ?? false,
      };
    });

    log.info(
      {
        attemptId,
        totalQuestions: details.length,
        viewAsPrivileged: isPrivilegedRole,
      },
      "Detailed results compiled successfully",
    );

    return {
      attemptId: attempt.id.toString(),
      quizId: attempt.quizId.toString(),
      quizTitle: attempt.quiz.title,
      levelNumber: attempt.quiz.levelNumber,
      score: attempt.score,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt.toISOString(),
      details: details,
    };
  }

  static async getStudentQuestions(quizId: bigint, log: Logger) {
    log.debug(
      { quizId: quizId.toString() },
      "Fetching questions for student active attempt",
    );

    const questions = await prisma.quizQuestion.findMany({
      where: { quizId: quizId },
      select: STUDENT_QUESTION_SELECT,
      orderBy: { questionOrder: "asc" },
    });

    log.info(
      { quizId: quizId.toString(), count: questions.length },
      "Student questions retrieved successfully",
    );

    return questions.map((q) => ({
      id: q.id.toString(),
      quizId: q.quizId.toString(),
      questionText: q.questionText,
      maxScore: q.maxScore,
      questionOrder: q.questionOrder,
    }));
  }

  // Answer methods
  static async getAnswers(attemptId: bigint, log: Logger) {
    log.debug({ attemptId: attemptId.toString() }, "Fetching student answers");

    const answers = await prisma.quizAnswer.findMany({
      where: { quizAttemptId: attemptId },
      select: ANSWER_SELECT,
      orderBy: { answeredAt: "asc" },
    });

    log.info({ count: answers.length }, "Student answers retrieved");
    return answers.map(mapAnswer);
  }

  static async createAnswer(data: CreateQuizAnswerInput, log: Logger) {
    const quizAttemptId = BigInt(data.quizAttemptId);
    const quizQuestionId = BigInt(data.quizQuestionId);
    log.debug(
      {
        quizAttemptId: quizAttemptId.toString(),
        quizQuestionId: quizQuestionId.toString(),
      },
      "Creating student answer",
    );

    const question = await prisma.quizQuestion.findUniqueOrThrow({
      where: { id: quizQuestionId },
      select: { answerText: true },
    });

    const isCorrect =
      normalizeAnswer(question.answerText) === normalizeAnswer(data.answerText);

    const answer = await prisma.quizAnswer.create({
      data: {
        quizAttemptId,
        quizQuestionId,
        answerText: data.answerText,
        isCorrect,
      },
      select: ANSWER_SELECT,
    });

    log.info(
      { answerId: answer.id.toString(), isCorrect },
      "Student answer created",
    );
    return mapAnswer(answer);
  }

  static async createBulkAnswers(
    data: CreateBulkQuizAnswerInput,
    studentId: string,
    log: Logger,
  ) {
    const quizAttemptId = BigInt(data.quizAttemptId);
    const quizId = BigInt(data.quizId);

    log.debug(
      { quizAttemptId: data.quizAttemptId, quizId: data.quizId },
      "Processing bulk student quiz answers submission",
    );

    const activeAttempt = await prisma.quizAttempt.findFirst({
      where: {
        id: quizAttemptId,
        quizId: quizId,
        studentId: studentId,
        submittedAt: null,
      },
    });

    if (!activeAttempt) {
      throw new QuizAttemptContextException(
        "Invalid, closed, or unauthorized quiz attempt context provided.",
      );
    }

    const validQuestions = await prisma.quizQuestion.findMany({
      where: { quizId: quizId },
      select: { id: true, answerText: true },
    });

    const questionMap = new Map(
      validQuestions.map((q) => [q.id, q.answerText]),
    );

    const recordsToInsert = data.answers.map((incoming) => {
      const questionId = BigInt(incoming.quizQuestionId);
      const correctAnswerText = questionMap.get(questionId);

      if (correctAnswerText === undefined) {
        throw new QuizAttemptValidationError(
          `Question ID ${incoming.quizQuestionId} does not belong to the requested quiz.`,
        );
      }

      const isCorrect =
        normalizeAnswer(correctAnswerText) ===
        normalizeAnswer(incoming.answerText);

      return {
        quizAttemptId,
        quizQuestionId: questionId,
        answerText: incoming.answerText,
        isCorrect,
      };
    });

    const savedAnswers = await prisma.$transaction(async (tx) => {
      const targetQuestionIds = recordsToInsert.map((r) => r.quizQuestionId);
      await tx.quizAnswer.deleteMany({
        where: {
          quizAttemptId,
          quizQuestionId: { in: targetQuestionIds },
        },
      });

      await tx.quizAnswer.createMany({
        data: recordsToInsert,
      });

      return tx.quizAnswer.findMany({
        where: {
          quizAttemptId,
          quizQuestionId: { in: targetQuestionIds },
        },
        select: ANSWER_SELECT,
        orderBy: { answeredAt: "asc" },
      });
    });

    log.info(
      { quizAttemptId: quizAttemptId.toString(), count: savedAnswers.length },
      "Bulk student answers saved and graded successfully",
    );

    return savedAnswers.map(mapAnswer);
  }

  static async updateAnswer(
    answerId: bigint,
    data: UpdateQuizAnswerInput,
    log: Logger,
  ) {
    log.debug({ answerId: answerId.toString() }, "Updating student answer");

    const existing = await prisma.quizAnswer.findUniqueOrThrow({
      where: { id: answerId },
      select: {
        quizQuestion: {
          select: { answerText: true },
        },
      },
    });

    const isCorrect =
      normalizeAnswer(existing.quizQuestion.answerText) ===
      normalizeAnswer(data.answerText);

    const answer = await prisma.quizAnswer.update({
      where: { id: answerId },
      data: {
        answerText: data.answerText,
        isCorrect,
      },
      select: ANSWER_SELECT,
    });

    log.info(
      { answerId: answer.id.toString(), isCorrect },
      "Student answer updated",
    );
    return mapAnswer(answer);
  }
}
