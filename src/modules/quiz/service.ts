import { prisma } from "@/libs/prisma";
import type {
  CreateQuizInput,
  UpdateQuizInput,
  CreateQuizQuestionInput,
  UpdateQuizQuestionInput,
  CreateKeywordInput,
  UpdateKeywordInput,
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
  groupId: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  isPublished: true,
  levelNumber: true,
  passThreshold: true,
  createdAt: true,
  updatedAt: true,
  prerequisites: {
    select: {
      id: true,
      quizId: true,
      materialId: true,
      material: { select: { id: true, title: true } },
    },
  },
} as const;

const QUESTION_SELECT = {
  id: true,
  quizId: true,
  questionText: true,
  answerText: true,
  maxScore: true,
  questionOrder: true,
  createdAt: true,
  updatedAt: true,
  quiz: {
    select: {
      id: true,
      title: true,
    },
  },
  keywords: {
    select: {
      id: true,
      questionId: true,
      blankOrder: true,
      correctAnswer: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { blankOrder: "asc" as const },
  },
} as const;

export const STUDENT_QUESTION_SELECT = {
  id: true,
  quizId: true,
  questionText: true,
  maxScore: true,
  questionOrder: true,
} as const;

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

const KEYWORD_SELECT = {
  id: true,
  questionId: true,
  blankOrder: true,
  correctAnswer: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─────────────────────────────────────────────
// Mappers: DB record → API response shape
// ─────────────────────────────────────────────

type QuizRecord = Prisma.QuizGetPayload<{ select: typeof QUIZ_SELECT }>;
type QuestionRecord = Prisma.QuizQuestionGetPayload<{
  select: typeof QUESTION_SELECT;
}>;
type AttemptRecord = Prisma.QuizAttemptGetPayload<{
  select: typeof ATTEMPT_SELECT;
}>;
type AnswerRecord = Prisma.QuizAnswerGetPayload<{
  select: typeof ANSWER_SELECT;
}>;
type KeywordRecord = Prisma.QuestionKeywordGetPayload<{
  select: typeof KEYWORD_SELECT;
}>;

function mapQuiz(quiz: QuizRecord) {
  return {
    id: quiz.id.toString(),
    groupId: quiz.groupId,
    title: quiz.title,
    description: quiz.description ?? null,
    startTime: quiz.startTime?.toISOString() ?? null,
    endTime: quiz.endTime?.toISOString() ?? null,
    isPublished: quiz.isPublished,
    levelNumber: quiz.levelNumber,
    passThreshold: quiz.passThreshold,
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
    prerequisites: quiz.prerequisites.map((p) => ({
      id: p.id,
      quizId: p.quizId.toString(),
      materialId: p.materialId.toString(),
      materialTitle: p.material.title,
    })),
  };
}

function mapQuestion(q: QuestionRecord) {
  return {
    id: q.id.toString(),
    quizId: q.quizId.toString(),
    quizTitle: q.quiz.title,
    questionText: q.questionText,
    answerText: q.answerText,
    maxScore: q.maxScore,
    questionOrder: q.questionOrder,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    keywords: q.keywords.map((k) => ({
      id: k.id.toString(),
      questionId: k.questionId.toString(),
      blankOrder: k.blankOrder,
      correctAnswer: k.correctAnswer,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    })),
  };
}

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

function mapKeyword(keyword: KeywordRecord) {
  return {
    id: keyword.id.toString(),
    questionId: keyword.questionId.toString(),
    blankOrder: keyword.blankOrder,
    correctAnswer: keyword.correctAnswer,
    createdAt: keyword.createdAt.toISOString(),
    updatedAt: keyword.updatedAt.toISOString(),
  };
}

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
  static async getQuizzes(groupId: string, log: Logger) {
    log.debug({ groupId }, "Fetching quizzes for group");

    const quizzes = await prisma.quiz.findMany({
      where: { groupId },
      select: QUIZ_SELECT,
      orderBy: { levelNumber: "asc" },
    });

    log.info({ groupId, count: quizzes.length }, "Quizzes retrieved");
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
    log.debug({ groupId: data.groupId, title: data.title }, "Creating quiz");

    assertValidTimeRange(data.startTime, data.endTime);

    // Validate levelNumber unique per group
    const dup = await prisma.quiz.findUnique({
      where: {
        groupId_levelNumber: {
          groupId: data.groupId,
          levelNumber: data.levelNumber,
        },
      },
    });
    if (dup) {
      throw new QuizAttemptValidationError(
        "Quiz level number already exists in this group.",
      );
    }

    const { prerequisiteMaterialIds, ...quizData } = data;

    // Validate prerequisites belong to the group
    if (prerequisiteMaterialIds && prerequisiteMaterialIds.length > 0) {
      const mats = await prisma.material.findMany({
        where: {
          id: { in: prerequisiteMaterialIds.map(BigInt) },
          groupId: data.groupId,
        },
      });
      if (mats.length !== prerequisiteMaterialIds.length) {
        throw new QuizAttemptValidationError(
          "Some prerequisite materials are invalid or do not belong to the group.",
        );
      }
    }

    const quiz = await prisma.$transaction(async (tx) => {
      const q = await tx.quiz.create({
        data: {
          groupId: quizData.groupId,
          title: quizData.title,
          description: quizData.description,
          startTime: quizData.startTime ? new Date(quizData.startTime) : null,
          endTime: quizData.endTime ? new Date(quizData.endTime) : null,
          isPublished: quizData.isPublished ?? false,
          levelNumber: quizData.levelNumber,
          passThreshold: quizData.passThreshold,
        },
        select: QUIZ_SELECT,
      });

      if (prerequisiteMaterialIds && prerequisiteMaterialIds.length > 0) {
        await tx.quizPrerequisite.createMany({
          data: prerequisiteMaterialIds.map((matId) => ({
            quizId: q.id,
            materialId: BigInt(matId),
          })),
        });
      }

      return tx.quiz.findUniqueOrThrow({
        where: { id: q.id },
        select: QUIZ_SELECT,
      });
    });

    log.info({ quizId: quiz.id.toString() }, "Quiz created");
    return mapQuiz(quiz);
  }

  static async updateQuiz(quizId: bigint, data: UpdateQuizInput, log: Logger) {
    log.debug({ quizId: quizId.toString() }, "Updating quiz");

    const existing = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        questions: {
          include: { keywords: true },
        },
      },
    });

    const resolvedStart = data.startTime ?? existing.startTime?.toISOString();
    const resolvedEnd = data.endTime ?? existing.endTime?.toISOString();
    assertValidTimeRange(resolvedStart, resolvedEnd);

    const { prerequisiteMaterialIds, ...quizData } = data;

    // Validate levelNumber unique if updated
    if (
      quizData.levelNumber !== undefined &&
      quizData.levelNumber !== existing.levelNumber
    ) {
      const dup = await prisma.quiz.findUnique({
        where: {
          groupId_levelNumber: {
            groupId: existing.groupId,
            levelNumber: quizData.levelNumber,
          },
        },
      });
      if (dup) {
        throw new QuizAttemptValidationError(
          "Quiz level number already exists in this group.",
        );
      }
    }

    // Validate prerequisites belong to the group
    if (prerequisiteMaterialIds && prerequisiteMaterialIds.length > 0) {
      const mats = await prisma.material.findMany({
        where: {
          id: { in: prerequisiteMaterialIds.map(BigInt) },
          groupId: existing.groupId,
        },
      });
      if (mats.length !== prerequisiteMaterialIds.length) {
        throw new QuizAttemptValidationError(
          "Some prerequisite materials are invalid or do not belong to the group.",
        );
      }
    }

    // Publishing Rule: zero blanks in any question cannot be published
    if (quizData.isPublished === true) {
      if (existing.questions.length === 0) {
        throw new QuizAttemptValidationError(
          "A quiz with no questions cannot be published.",
        );
      }
      for (const q of existing.questions) {
        if (q.keywords.length === 0) {
          throw new QuizAttemptValidationError(
            "All questions must have at least one blank to be published.",
          );
        }
      }
    }

    const quiz = await prisma.$transaction(async (tx) => {
      const q = await tx.quiz.update({
        where: { id: quizId },
        data: {
          title: quizData.title,
          description: quizData.description,
          startTime: quizData.startTime ? new Date(quizData.startTime) : null,
          endTime: quizData.endTime ? new Date(quizData.endTime) : null,
          isPublished: quizData.isPublished,
          levelNumber: quizData.levelNumber,
          passThreshold: quizData.passThreshold,
        },
        select: QUIZ_SELECT,
      });

      if (prerequisiteMaterialIds !== undefined) {
        await tx.quizPrerequisite.deleteMany({
          where: { quizId },
        });
        if (prerequisiteMaterialIds.length > 0) {
          await tx.quizPrerequisite.createMany({
            data: prerequisiteMaterialIds.map((matId) => ({
              quizId,
              materialId: BigInt(matId),
            })),
          });
        }
      }

      return tx.quiz.findUniqueOrThrow({
        where: { id: quizId },
        select: QUIZ_SELECT,
      });
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
// Quiz Question Service
// ─────────────────────────────────────────────

export abstract class QuizQuestionService {
  static async getQuestions(quizId: bigint, log: Logger) {
    log.debug({ quizId: quizId.toString() }, "Fetching questions");

    const questions = await prisma.quizQuestion.findMany({
      where: { quizId },
      select: QUESTION_SELECT,
      orderBy: { questionOrder: "asc" },
    });

    log.info(
      { quizId: quizId.toString(), count: questions.length },
      "Questions retrieved",
    );
    return questions.map(mapQuestion);
  }

  static async createQuestion(data: CreateQuizQuestionInput, log: Logger) {
    const quizId = BigInt(data.quizId);
    log.debug({ quizId: quizId.toString() }, "Creating question");

    const { _max } = await prisma.quizQuestion.aggregate({
      where: { quizId },
      _max: { questionOrder: true },
    });
    const questionOrder = data.questionOrder ?? (_max.questionOrder ?? 0) + 1;

    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
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
        select: { quizId: true, questionOrder: true },
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
          quizId: question.quizId,
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

  static async getStudentQuestions(quizId: bigint, log: Logger) {
    log.debug(
      { quizId: quizId.toString() },
      "Fetching limited question data for student quiz execution context",
    );

    const questions = await prisma.quizQuestion.findMany({
      where: { quizId },
      select: STUDENT_QUESTION_SELECT,
      orderBy: { questionOrder: "asc" },
    });

    log.info(
      { quizId: quizId.toString(), count: questions.length },
      "Student question data retrieved successfully",
    );

    return questions.map((q) => ({
      id: q.id.toString(),
      quizId: q.quizId.toString(),
      questionText: q.questionText,
      maxScore: q.maxScore,
      questionOrder: q.questionOrder,
      answerText: null,
    }));
  }
}

// ─────────────────────────────────────────────
// Question Keyword Service
// ─────────────────────────────────────────────

export abstract class QuestionKeywordService {
  static async getKeywords(questionId: bigint, log: Logger) {
    log.debug({ questionId: questionId.toString() }, "Fetching keywords");

    const keywords = await prisma.questionKeyword.findMany({
      where: { questionId },
      select: KEYWORD_SELECT,
      orderBy: { blankOrder: "asc" },
    });

    return keywords.map(mapKeyword);
  }

  static async createKeyword(data: CreateKeywordInput, log: Logger) {
    const questionId = BigInt(data.questionId);
    log.debug(
      { questionId: questionId.toString(), blankOrder: data.blankOrder },
      "Creating keyword",
    );

    const dup = await prisma.questionKeyword.findUnique({
      where: {
        questionId_blankOrder: {
          questionId,
          blankOrder: data.blankOrder,
        },
      },
    });

    if (dup) {
      throw new QuizAttemptValidationError(
        "Duplicate blank order for this question.",
      );
    }

    const keyword = await prisma.questionKeyword.create({
      data: {
        questionId,
        blankOrder: data.blankOrder,
        correctAnswer: data.correctAnswer,
      },
      select: {
        ...KEYWORD_SELECT,
        question: {
          select: {
            quiz: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    return {
      ...mapKeyword(keyword),
      quizId: keyword.question.quiz.id.toString(),
      quizTitle: keyword.question.quiz.title,
    };
  }

  static async updateKeyword(
    keywordId: bigint,
    data: UpdateKeywordInput,
    log: Logger,
  ) {
    log.debug({ keywordId: keywordId.toString() }, "Updating keyword");

    if (data.blankOrder !== undefined) {
      const keyword = await prisma.questionKeyword.findUnique({
        where: { id: keywordId },
      });
      if (keyword && keyword.blankOrder !== data.blankOrder) {
        const dup = await prisma.questionKeyword.findUnique({
          where: {
            questionId_blankOrder: {
              questionId: keyword.questionId,
              blankOrder: data.blankOrder,
            },
          },
        });
        if (dup) {
          throw new QuizAttemptValidationError(
            "Duplicate blank order for this question.",
          );
        }
      }
    }

    const keyword = await prisma.questionKeyword.update({
      where: { id: keywordId },
      data: {
        blankOrder: data.blankOrder,
        correctAnswer: data.correctAnswer,
      },
      select: KEYWORD_SELECT,
    });

    return mapKeyword(keyword);
  }

  static async deleteKeyword(keywordId: bigint, log: Logger) {
    log.debug({ keywordId: keywordId.toString() }, "Deleting keyword");

    const keyword = await prisma.questionKeyword.delete({
      where: { id: keywordId },
      select: { id: true },
    });

    return { id: keyword.id.toString() };
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
      "Fetching direct quiz progress",
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
      "Creating quiz attempt",
    );

    // Fetch Quiz and prerequisites
    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        prerequisites: {
          include: {
            material: true,
          },
        },
      },
    });

    // 🛡️ Gate 1: Prerequisite Material Read check
    for (const prereq of quiz.prerequisites) {
      const readRecord = await prisma.materialRead.findUnique({
        where: {
          studentId_materialId: {
            studentId,
            materialId: prereq.materialId,
          },
        },
      });

      if (!readRecord || readRecord.materialVersion < prereq.material.version) {
        throw new QuizAttemptValidationError(
          `You must read prerequisite material "${prereq.material.title}" first.`,
        );
      }
    }

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
    log.debug({ attemptId, studentId }, "Submitting and grading quiz attempt");

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
    log.debug({ filters }, "Fetching bulk quiz attempts results summary");

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
      orderBy: { submittedAt: "desc" },
    });

    log.info(
      { count: attempts.length },
      "Bulk quiz attempts results gathered successfully",
    );

    return attempts.map((attempt) => ({
      attemptId: attempt.id.toString(),
      quizId: attempt.quizId.toString(),
      quizTitle: attempt.quiz.title,
      levelNumber: attempt.quiz.levelNumber,
      studentId: attempt.studentId,
      studentName: attempt.student.name,
      studentEmail: attempt.student.email,
      score: attempt.score,
      totalQuestions: attempt.quiz._count.questions,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
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
      "Fetching detailed quiz attempt results",
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
        "Result fetch blocked",
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
    const quizId = BigInt(data.quizId);

    log.debug(
      { quizAttemptId: data.quizAttemptId, quizId: data.quizId },
      "Processing bulk quiz answers submission",
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
  return text
    .replace(/<\/?(br|p|div|tr|td|li|ul|ol|h[1-6])\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;\s])/g, "$1")
    .trim()
    .toLowerCase();
}
