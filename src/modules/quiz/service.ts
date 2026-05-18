import { prisma } from "@/libs/prisma";
import type {
  CreateQuizInput,
  UpdateQuizInput,
  CreateQuizQuestionInput,
  UpdateQuizQuestionInput,
  CreateQuizLevelInput,
  UpdateQuizLevelInput,
  CreateQuizAttemptInput,
  CreateQuizAnswerInput,
  UpdateQuizAnswerInput,
  CreateBulkQuizAnswerInput,
} from "./schema";
import type { Logger } from "pino";
import {
  InvalidTimeRangeError,
  QuizAttemptContextException,
  QuizAttemptValidationError,
} from "./error";
import { Prisma } from "@generated/prisma";

// ─────────────────────────────────────────────
// Prisma Select Shapes
// ─────────────────────────────────────────────

const QUIZ_SELECT = {
  id: true,
  materialId: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  material: { select: { id: true, title: true } },
  levels: {
    select: {
      id: true,
      quizId: true,
      title: true,
      levelOrder: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { levelOrder: "asc" as const },
  },
} as const;

const LEVEL_SELECT = {
  id: true,
  quizId: true,
  title: true,
  levelOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

const QUESTION_SELECT = {
  id: true,
  quizLevelId: true,
  questionText: true,
  answerText: true,
  maxScore: true,
  questionOrder: true,
  createdAt: true,
  updatedAt: true,
  quizLevel: {
    select: {
      title: true,
      quiz: { select: { id: true, title: true } },
    },
  },
} as const;

export const STUDENT_QUESTION_SELECT = {
  id: true,
  quizLevelId: true,
  questionText: true,
  maxScore: true,
  questionOrder: true,
} as const;

const ATTEMPT_SELECT = {
  id: true,
  quizLevelId: true,
  studentId: true,
  startedAt: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  quizLevel: {
    select: {
      quiz: {
        select: { title: true },
      },
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

// ─────────────────────────────────────────────
// Mappers: DB record → API response shape
// ─────────────────────────────────────────────

type QuizRecord = Prisma.QuizGetPayload<{ select: typeof QUIZ_SELECT }>;
type LevelRecord = Prisma.QuizLevelGetPayload<{ select: typeof LEVEL_SELECT }>;
type QuestionRecord = Prisma.QuizQuestionGetPayload<{
  select: typeof QUESTION_SELECT;
}>;
type AttemptRecord = Prisma.QuizAttemptGetPayload<{
  select: typeof ATTEMPT_SELECT;
}>;
type AnswerRecord = Prisma.QuizAnswerGetPayload<{
  select: typeof ANSWER_SELECT;
}>;

function mapLevel(level: LevelRecord) {
  return {
    id: level.id.toString(),
    quizId: level.quizId.toString(),
    title: level.title,
    levelOrder: level.levelOrder,
    createdAt: level.createdAt.toISOString(),
    updatedAt: level.updatedAt.toISOString(),
  };
}

function mapQuiz(quiz: QuizRecord) {
  return {
    id: quiz.id.toString(),
    materialId: quiz.materialId.toString(),
    material: quiz.material.title,
    title: quiz.title,
    description: quiz.description ?? null,
    startTime: quiz.startTime?.toISOString() ?? null,
    endTime: quiz.endTime?.toISOString() ?? null,
    isPublished: quiz.isPublished,
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
    levels: quiz.levels.map(mapLevel),
  };
}

function mapQuestion(q: QuestionRecord) {
  return {
    id: q.id.toString(),
    quizLevelId: q.quizLevelId.toString(),
    quizLevelTitle: q.quizLevel.title,
    quizId: q.quizLevel.quiz.id.toString(),
    quizTitle: q.quizLevel.quiz.title,
    questionText: q.questionText,
    answerText: q.answerText,
    maxScore: q.maxScore,
    questionOrder: q.questionOrder,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function mapAttempt(attempt: AttemptRecord) {
  return {
    id: attempt.id.toString(),
    quizLevelId: attempt.quizLevelId.toString(),
    quizTitle: attempt.quizLevel.quiz.title,
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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function assertValidTimeRange(
  startTime?: string | null,
  endTime?: string | null,
) {
  if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
    throw new InvalidTimeRangeError();
  }
}

// ─────────────────────────────────────────────
// Quiz Service
// ─────────────────────────────────────────────

export abstract class QuizService {
  static async getQuizzes(materialId: bigint, log: Logger) {
    log.debug(
      { materialId: materialId.toString() },
      "Fetching quizzes for material",
    );

    const quizzes = await prisma.quiz.findMany({
      where: { materialId },
      select: QUIZ_SELECT,
      orderBy: { createdAt: "desc" },
    });

    log.info(
      { materialId: materialId.toString(), count: quizzes.length },
      "Quizzes retrieved",
    );
    return quizzes.map(mapQuiz);
  }

  static async getQuiz(quizId: bigint, log: Logger) {
    log.debug({ quizId: quizId.toString() }, "Fetching quiz");

    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: QUIZ_SELECT,
    });

    log.info({ quizId: quiz.id.toString() }, "Quiz retrieved");
    return mapQuiz(quiz);
  }

  static async createQuiz(data: CreateQuizInput, log: Logger) {
    const materialId = BigInt(data.materialId);
    log.debug(
      { materialId: materialId.toString(), title: data.title },
      "Creating quiz",
    );

    assertValidTimeRange(data.startTime, data.endTime);

    const quiz = await prisma.quiz.create({
      data: {
        materialId,
        title: data.title,
        description: data.description,
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        isPublished: data.isPublished ?? false,
      },
      select: QUIZ_SELECT,
    });

    log.info({ quizId: quiz.id.toString() }, "Quiz created");
    return mapQuiz(quiz);
  }

  static async updateQuiz(quizId: bigint, data: UpdateQuizInput, log: Logger) {
    log.debug({ quizId: quizId.toString() }, "Updating quiz");

    const existing = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { startTime: true, endTime: true },
    });

    const resolvedStart = data.startTime ?? existing?.startTime?.toISOString();
    const resolvedEnd = data.endTime ?? existing?.endTime?.toISOString();
    assertValidTimeRange(resolvedStart, resolvedEnd);

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        isPublished: data.isPublished,
      },
      select: QUIZ_SELECT,
    });

    log.info({ quizId: quiz.id.toString() }, "Quiz updated");
    return mapQuiz(quiz);
  }

  static async deleteQuiz(quizId: bigint, log: Logger) {
    log.debug({ quizId: quizId.toString() }, "Deleting quiz");

    const quiz = await prisma.quiz.delete({
      where: { id: quizId },
      select: { id: true },
    });

    log.info({ quizId: quiz.id.toString() }, "Quiz deleted");
    return { id: quiz.id.toString() };
  }
}

// ─────────────────────────────────────────────
// Quiz Level Service
// ─────────────────────────────────────────────

export abstract class QuizLevelService {
  static async getQuizLevels(quizId: bigint, log: Logger) {
    log.debug({ quizId: quizId.toString() }, "Fetching quiz levels");

    const levels = await prisma.quizLevel.findMany({
      where: { quizId },
      select: LEVEL_SELECT,
      orderBy: { levelOrder: "asc" },
    });

    log.info(
      { quizId: quizId.toString(), count: levels.length },
      "Quiz levels retrieved",
    );
    return levels.map(mapLevel);
  }

  static async getQuizLevel(levelId: bigint, log: Logger) {
    log.debug({ levelId: levelId.toString() }, "Fetching quiz level");

    const level = await prisma.quizLevel.findUniqueOrThrow({
      where: { id: levelId },
      select: LEVEL_SELECT,
    });

    log.info({ levelId: level.id.toString() }, "Quiz level retrieved");
    return mapLevel(level);
  }

  static async createQuizLevel(data: CreateQuizLevelInput, log: Logger) {
    const quizId = BigInt(data.quizId);
    log.debug(
      { quizId: quizId.toString(), title: data.title },
      "Creating quiz level",
    );

    const level = await prisma.quizLevel.create({
      data: { quizId, title: data.title, levelOrder: data.levelOrder },
      select: LEVEL_SELECT,
    });

    log.info({ levelId: level.id.toString() }, "Quiz level created");
    return mapLevel(level);
  }

  static async updateQuizLevel(
    levelId: bigint,
    data: UpdateQuizLevelInput,
    log: Logger,
  ) {
    log.debug({ levelId: levelId.toString() }, "Updating quiz level");

    const level = await prisma.quizLevel.update({
      where: { id: levelId },
      data: { title: data.title, levelOrder: data.levelOrder },
      select: LEVEL_SELECT,
    });

    log.info({ levelId: level.id.toString() }, "Quiz level updated");
    return mapLevel(level);
  }

  static async deleteQuizLevel(levelId: bigint, log: Logger) {
    log.debug({ levelId: levelId.toString() }, "Deleting quiz level");

    const level = await prisma.quizLevel.delete({
      where: { id: levelId },
      select: { id: true },
    });

    log.info({ levelId: level.id.toString() }, "Quiz level deleted");
    return { id: level.id.toString() };
  }
}

// ─────────────────────────────────────────────
// Quiz Question Service
// ─────────────────────────────────────────────

export abstract class QuizQuestionService {
  static async getQuestions(quizLevelId: bigint, log: Logger) {
    log.debug({ quizLevelId: quizLevelId.toString() }, "Fetching questions");

    const questions = await prisma.quizQuestion.findMany({
      where: { quizLevelId },
      select: QUESTION_SELECT,
      orderBy: { questionOrder: "asc" },
    });

    log.info(
      { quizLevelId: quizLevelId.toString(), count: questions.length },
      "Questions retrieved",
    );
    return questions.map(mapQuestion);
  }

  static async createQuestion(data: CreateQuizQuestionInput, log: Logger) {
    const quizLevelId = BigInt(data.quizLevelId);
    log.debug({ quizLevelId: quizLevelId.toString() }, "Creating question");

    const { _max } = await prisma.quizQuestion.aggregate({
      where: { quizLevelId },
      _max: { questionOrder: true },
    });
    const questionOrder = data.questionOrder ?? (_max.questionOrder ?? 0) + 1;

    const question = await prisma.quizQuestion.create({
      data: {
        quizLevelId,
        questionText: data.questionText,
        answerText: data.answerText,
        maxScore: data.maxScore ?? 100,
        questionOrder,
      },
      select: QUESTION_SELECT,
    });

    log.info(
      { questionId: question.id.toString(), questionOrder },
      "Question created",
    );
    return mapQuestion(question);
  }

  static async updateQuestion(
    questionId: bigint,
    data: UpdateQuizQuestionInput,
    log: Logger,
  ) {
    log.debug({ questionId: questionId.toString() }, "Updating question");

    const question = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        questionText: data.questionText,
        answerText: data.answerText,
        maxScore: data.maxScore,
        questionOrder: data.questionOrder,
      },
      select: QUESTION_SELECT,
    });

    log.info({ questionId: question.id.toString() }, "Question updated");
    return mapQuestion(question);
  }

  static async deleteQuestion(questionId: bigint, log: Logger) {
    log.debug({ questionId: questionId.toString() }, "Deleting question");

    return prisma.$transaction(async (tx) => {
      const question = await tx.quizQuestion.findUnique({
        where: { id: questionId },
        select: { quizLevelId: true, questionOrder: true },
      });

      if (!question) {
        throw new Prisma.PrismaClientKnownRequestError("Question not found", {
          code: "P2025",
          clientVersion: "6.5.0",
        });
      }

      await tx.quizQuestion.delete({ where: { id: questionId } });

      await tx.quizQuestion.updateMany({
        where: {
          quizLevelId: question.quizLevelId,
          questionOrder: { gt: question.questionOrder },
        },
        data: { questionOrder: { decrement: 1 } },
      });

      log.info(
        { questionId: questionId.toString() },
        "Question deleted and sequence reordered",
      );
      return { id: questionId.toString() };
    });
  }

  static async getStudentQuestions(quizLevelId: bigint, log: Logger) {
    log.debug(
      { quizLevelId: quizLevelId.toString() },
      "Fetching limited question data for student quiz execution context",
    );

    const questions = await prisma.quizQuestion.findMany({
      where: { quizLevelId },
      select: STUDENT_QUESTION_SELECT,
      orderBy: { questionOrder: "asc" },
    });

    log.info(
      { quizLevelId: quizLevelId.toString(), count: questions.length },
      "Student question data retrieved successfully",
    );

    // Map fields matching your custom application mapper conventions safely
    return questions.map((q) => ({
      id: q.id.toString(),
      quizLevelId: q.quizLevelId.toString(),
      questionText: q.questionText,
      maxScore: q.maxScore,
      questionOrder: q.questionOrder,
      answerText: null,
    }));
  }
}

// ─────────────────────────────────────────────
// Quiz Attempt Service
// ─────────────────────────────────────────────

export abstract class QuizAttemptService {
  static async getAttempts(
    quizId: bigint | undefined,
    studentId: string | undefined,
    log: Logger,
  ) {
    log.debug({ quizId: quizId?.toString(), studentId }, "Fetching attempts");

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        ...(quizId && { quizId }),
        ...(studentId && { studentId }),
      },
      select: ATTEMPT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    log.info({ count: attempts.length }, "Attempts retrieved");
    return attempts.map(mapAttempt);
  }

  static async getAttempt(attemptId: bigint, log: Logger) {
    log.debug({ attemptId: attemptId.toString() }, "Fetching attempt");

    const attempt = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { ...ATTEMPT_SELECT, answers: { select: ANSWER_SELECT } },
    });

    log.info({ attemptId: attempt.id.toString() }, "Attempt retrieved");
    return { ...mapAttempt(attempt), answers: attempt.answers.map(mapAnswer) };
  }

  static async getProgress(quizId: bigint, studentId: string, log: Logger) {
    log.debug(
      { quizId: quizId.toString(), studentId },
      "Fetching direct level-by-level quiz progress",
    );

    const levels = await prisma.quizLevel.findMany({
      where: { quizId: quizId },
      orderBy: { levelOrder: "asc" },
      select: {
        id: true,
        title: true,
        levelOrder: true,
        _count: { select: { questions: true } },
      },
    });

    const levelIds = levels.map((l) => l.id);

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizLevelId: { in: levelIds },
        studentId: studentId,
      },
      orderBy: { createdAt: "desc" }, // Latest attempts come first
      select: {
        id: true,
        quizLevelId: true,
        submittedAt: true,
        createdAt: true,
      },
    });

    const levelProgress = levels.map((level) => {
      const latestLevelAttempt = attempts.find(
        (a) => a.quizLevelId === level.id,
      );

      let status = "NOT_STARTED";
      let currentAttemptId: string | null = null;

      if (latestLevelAttempt) {
        currentAttemptId = latestLevelAttempt.id.toString();
        status = latestLevelAttempt.submittedAt ? "COMPLETED" : "IN_PROGRESS";
      }

      return {
        levelId: level.id.toString(),
        title: level.title,
        levelOrder: level.levelOrder,
        status: status,
        currentAttemptId: currentAttemptId,
        totalQuestions: level._count.questions,
      };
    });

    log.info(
      {
        studentId,
        quizId: quizId.toString(),
        totalLevelsMapped: levels.length,
      },
      "Granular level progress compiled successfully",
    );

    return {
      quizId: quizId.toString(),
      levels: levelProgress,
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
    const quizLevelId = BigInt(data.quizLevelId);
    log.debug(
      { quizLevelId: quizLevelId.toString(), studentId },
      "Creating level attempt",
    );

    // 🛑 DEFENSIVE GUARD: Prevent creating multiple active attempts for the same level
    const existingActiveAttempt = await prisma.quizAttempt.findFirst({
      where: {
        studentId: studentId,
        quizLevelId: quizLevelId,
        submittedAt: null,
      },
    });

    if (existingActiveAttempt) {
      log.warn(
        {
          studentId,
          quizLevelId: quizLevelId.toString(),
          attemptId: existingActiveAttempt.id.toString(),
        },
        "Blocked duplicate active attempt creation request",
      );
      // Throw your custom domain business exception to be handled gracefully by your .onError handler
      throw new QuizAttemptValidationError(
        "You already have an active session for this level. Please submit it first.",
      );
    }

    // Atomic execution creation using updated structural parameters
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizLevelId, // ✅ Updated reference mapping key
        studentId,
      },
      select: ATTEMPT_SELECT,
    });

    log.info(
      { attemptId: attempt.id.toString() },
      "Level attempt session instantiated successfully",
    );
    return mapAttempt(attempt);
  }

  static async submitAttempt(
    attemptId: bigint,
    studentId: string,
    log: Logger,
  ) {
    log.debug({ attemptId, studentId }, "Submitting and grading quiz attempt");

    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        studentId: studentId,
        submittedAt: null,
      },
      include: {
        quizLevel: {
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

    const totalQuestions = attempt.quizLevel._count.questions;

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
      select: ATTEMPT_SELECT, // Uses your updated selection object
    });

    log.info(
      { attemptId, score: finalScore, totalQuestions },
      "Attempt submitted and graded successfully",
    );

    return mapAttempt(finalizedAttempt);
  }

  static async getAttemptResults(
    attemptId: string,
    studentId: string,
    log: Logger,
  ) {
    const id = BigInt(attemptId);
    log.debug(
      { attemptId, studentId },
      "Fetching detailed quiz attempt results",
    );

    // 1. Fetch Attempt, related QuizLevel, all Questions, and the Student's Answers
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        id: id,
        studentId: studentId, // Security guard: students can only see their own results
      },
      include: {
        quizLevel: {
          include: {
            quiz: { select: { title: true } },
            questions: { orderBy: { questionOrder: "asc" } },
          },
        },
        answers: true, // Fetch all answers submitted in this specific attempt
      },
    });

    if (!attempt) {
      log.warn(
        { attemptId, studentId },
        "Result fetch blocked: Attempt not found or unauthorized",
      );
      throw new QuizAttemptContextException(
        "Attempt not found or you do not have permission to view it.",
      );
    }

    // 2. Guard: Prevent viewing results if the attempt is still in progress!
    if (!attempt.submittedAt) {
      log.warn(
        { attemptId },
        "Result fetch blocked: Attempt is not yet submitted",
      );
      throw new QuizAttemptValidationError(
        "Cannot view detailed results for an unsubmitted attempt. Please submit the quiz first.",
      );
    }

    // 3. Map every question against the user's answers
    const details = attempt.quizLevel.questions.map((question) => {
      // Find the specific answer the user gave for this question
      const userAnswerRecord = attempt.answers.find(
        (a) => a.quizQuestionId === question.id,
      );

      return {
        questionId: question.id.toString(),
        questionText: question.questionText,
        maxScore: question.maxScore,
        userAnswer: userAnswerRecord?.answerText ?? null, // Will be null if skipped
        correctAnswer: question.answerText,
        isCorrect: userAnswerRecord?.isCorrect ?? false, // Automatically wrong if skipped
      };
    });

    log.info(
      { attemptId, totalQuestions: details.length },
      "Detailed results compiled successfully",
    );

    return {
      attemptId: attempt.id.toString(),
      quizLevelId: attempt.quizLevelId.toString(),
      quizTitle: attempt.quizLevel.quiz.title,
      levelTitle: attempt.quizLevel.title,
      score: attempt.score,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt.toISOString(), // Safe to cast because of our Guard above
      details: details,
    };
  }
}

// ─────────────────────────────────────────────
// Quiz Answer Service
// ─────────────────────────────────────────────

export abstract class QuizAnswerService {
  static async getAnswers(attemptId: bigint, log: Logger) {
    log.debug({ attemptId: attemptId.toString() }, "Fetching answers");

    const answers = await prisma.quizAnswer.findMany({
      where: { quizAttemptId: attemptId },
      select: ANSWER_SELECT,
      orderBy: { answeredAt: "asc" },
    });

    log.info({ count: answers.length }, "Answers retrieved");
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
      "Creating answer",
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

    log.info({ answerId: answer.id.toString(), isCorrect }, "Answer created");
    return mapAnswer(answer);
  }

  static async createBulkAnswers(
    data: CreateBulkQuizAnswerInput,
    studentId: string,
    log: Logger,
  ) {
    const quizAttemptId = BigInt(data.quizAttemptId);
    const quizLevelId = BigInt(data.quizLevelId);

    log.debug(
      { quizAttemptId: data.quizAttemptId, quizLevelId: data.quizLevelId },
      "Processing bulk quiz answers submission",
    );

    const activeAttempt = await prisma.quizAttempt.findFirst({
      where: {
        id: quizAttemptId,
        quizLevelId: quizLevelId,
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
      where: { quizLevelId: quizLevelId },
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
          `Question ID ${incoming.quizQuestionId} does not belong to the requested quiz level.`,
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
      });
    });

    log.info(
      { quizAttemptId: data.quizAttemptId, totalSaved: savedAnswers.length },
      "Bulk answers processed successfully",
    );
    return savedAnswers.map(mapAnswer);
  }

  static async updateAnswer(
    answerId: bigint,
    data: UpdateQuizAnswerInput,
    log: Logger,
  ) {
    log.debug({ answerId: answerId.toString() }, "Updating answer");

    const existing = await prisma.quizAnswer.findUniqueOrThrow({
      where: { id: answerId },
      select: { quizQuestion: { select: { answerText: true } } },
    });

    const isCorrect =
      normalizeAnswer(existing.quizQuestion.answerText) ===
      normalizeAnswer(data.answerText);

    const answer = await prisma.quizAnswer.update({
      where: { id: answerId },
      data: { answerText: data.answerText, isCorrect },
      select: ANSWER_SELECT,
    });

    log.info({ answerId: answer.id.toString(), isCorrect }, "Answer updated");
    return mapAnswer(answer);
  }
}

// ─────────────────────────────────────────────
// Shared utility
// ─────────────────────────────────────────────
function normalizeAnswer(text: string): string {
  return (
    text
      // 1. Convert structural opening AND closing tags (including lists) into spaces
      //    so adjacent block inline values never smash together.
      .replace(/<\/?(br|p|div|tr|td|li|ul|ol|h[1-6])\/?>/gi, " ")

      // 2. Strip out any remaining inline/formatting tags safely (like <strong>, <a>, etc.)
      .replace(/<\/?[^>]+(>|$)/g, "")

      // 3. Convert HTML space entities back to true whitespace tokens
      .replace(/&nbsp;/g, " ")

      // 4. Collapse multi-spaces, tabs, and actual line breaks (\n) into a single clean space
      .replace(/\s+/g, " ")

      // 5. 🚀 NEW: Remove extra spaces before common punctuation marks (.,!?;;)
      //    This turns "tag ." into "tag." and "word ," into "word,"
      .replace(/\s+([.,!?;\s])/g, "$1")

      // 6. Clean up outer margins and unify lowercase casing properties
      .trim()
      .toLowerCase()
  );
}
