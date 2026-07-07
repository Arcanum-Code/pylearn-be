import { prisma } from "@/libs/prisma";
import type {
  CreateQuizInput,
  UpdateQuizInput,
  CreateQuizQuestionInput,
  UpdateQuizQuestionInput,
  CreateKeywordInput,
  UpdateKeywordInput,
} from "./schema";
import type { Logger } from "pino";
import { InvalidTimeRangeError } from "./error";
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
