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
  items: {
    select: {
      id: true,
      keywordId: true,
      answerText: true,
      isCorrect: true,
    },
  },
} as const;

export const STUDENT_QUESTION_SELECT = {
  id: true,
  quizId: true,
  questionText: true,
  answerText: true,
  maxScore: true,
  questionOrder: true,
  keywords: {
    select: {
      id: true,
      blankOrder: true,
      startIndex: true,
      endIndex: true,
    },
    orderBy: { blankOrder: "asc" },
  },
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
    items:
      answer.items?.map((item) => ({
        id: item.id.toString(),
        keywordId: item.keywordId.toString(),
        answerText: item.answerText,
        isCorrect: item.isCorrect,
      })) ?? [],
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

    // Determine the next attempt number for this student/quiz
    const lastAttempt = await prisma.quizAttempt.findFirst({
      where: { quizId, studentId },
      orderBy: { attemptNumber: "desc" },
      select: { attemptNumber: true },
    });
    const nextAttemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        studentId,
        attemptNumber: nextAttemptNumber,
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

    // Fetch all student answers for this attempt
    const answers = await prisma.quizAnswer.findMany({
      where: {
        quizAttemptId: attemptId,
      },
      include: {
        quizQuestion: {
          include: { keywords: true },
        },
        items: true,
      },
    });

    let allScore = 0;

    for (const ans of answers) {
      const q = ans.quizQuestion;
      const isBlankQuestion = q.keywords.length > 0;

      if (isBlankQuestion) {
        // Average point scoring: (correctCount / totalBlanks) * maxScore
        const correctCount = ans.items.filter((item) => item.isCorrect).length;
        const totalBlanks = q.keywords.length;
        const points =
          totalBlanks > 0 ? (correctCount / totalBlanks) * q.maxScore : 0;
        allScore += points;
      } else {
        if (ans.isCorrect) {
          allScore += q.maxScore;
        }
      }
    }

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
            questions: {
              orderBy: { questionOrder: "asc" },
              include: { keywords: { orderBy: { blankOrder: "asc" } } },
            },
          },
        },
        answers: {
          include: { items: true },
        },
      },
    });

    if (!attempt) {
      log.warn(
        { attemptId, userId: ctx.userId, role: ctx.userRole },
        "student result fetch blocked",
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

      const isBlankQuestion = question.keywords.length > 0;
      let blanksBreakdown: any[] = [];
      let userAnswer: string | null = userAnswerRecord?.answerText ?? null;

      if (isBlankQuestion) {
        blanksBreakdown = question.keywords.map((kw) => {
          const userItem = userAnswerRecord?.items.find(
            (item) => item.keywordId === kw.id,
          );
          return {
            keywordId: kw.id.toString(),
            blankOrder: kw.blankOrder,
            userAnswer: userItem ? userItem.answerText : null,
            correctAnswer: kw.correctAnswer,
            isCorrect: userItem ? userItem.isCorrect : false,
          };
        });

        if (userAnswerRecord?.items) {
          let result = "";
          let lastIndex = 0;
          const sortedKeywords = [...question.keywords].sort(
            (a, b) => a.startIndex - b.startIndex,
          );
          for (const kw of sortedKeywords) {
            const userItem = userAnswerRecord.items.find(
              (item) => item.keywordId === kw.id,
            );
            const userBlankAnswer = userItem ? userItem.answerText : "";
            result += question.answerText.slice(lastIndex, kw.startIndex);
            result += userBlankAnswer;
            lastIndex = kw.endIndex;
          }
          result += question.answerText.slice(lastIndex);
          userAnswer = result;
        }
      }

      return {
        questionId: question.id.toString(),
        questionText: question.questionText,
        maxScore: question.maxScore,
        userAnswer,
        correctAnswer: question.answerText,
        isCorrect: userAnswerRecord?.isCorrect ?? false,
        ...(isBlankQuestion && { blanks: blanksBreakdown }),
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

    return questions.map((q) => {
      let blankQuestionText = q.questionText;
      if (q.keywords && q.keywords.length > 0) {
        let result = "";
        let lastIndex = 0;
        const sortedKeywords = [...q.keywords].sort(
          (a, b) => a.startIndex - b.startIndex,
        );
        sortedKeywords.forEach((kw) => {
          result += q.answerText.slice(lastIndex, kw.startIndex);
          result += `[blank_${kw.blankOrder}]`;
          lastIndex = kw.endIndex;
        });
        result += q.answerText.slice(lastIndex);
        blankQuestionText = result;
      }

      return {
        id: q.id.toString(),
        quizId: q.quizId.toString(),
        questionText: q.questionText,
        blankQuestionText: blankQuestionText,
        maxScore: q.maxScore,
        questionOrder: q.questionOrder,
        blanks: q.keywords.map((b) => ({
          keywordId: b.id.toString(),
          blankOrder: b.blankOrder,
          correctAnswerLength: b.endIndex - b.startIndex,
        })),
      };
    });
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

    // Fetch the question and its keywords
    const question = await prisma.quizQuestion.findUniqueOrThrow({
      where: { id: quizQuestionId },
      include: { keywords: true },
    });

    let isCorrect = false;
    const preparedItems: {
      keywordId: bigint;
      answerText: string;
      isCorrect: boolean;
    }[] = [];
    const isBlankQuestion = question.keywords.length > 0;
    const studentAnswerText = data.answerText ?? "";

    if (isBlankQuestion) {
      const submittedItems = data.items ?? [];
      let correctBlanks = 0;

      for (const kw of question.keywords) {
        const submitted = submittedItems.find(
          (item) => item.keywordId === kw.id.toString(),
        );
        const submittedText = submitted ? submitted.answerText : "";
        const correct =
          normalizeAnswer(kw.correctAnswer) === normalizeAnswer(submittedText);
        if (correct) {
          correctBlanks++;
        }
        preparedItems.push({
          keywordId: kw.id,
          answerText: submittedText,
          isCorrect: correct,
        });
      }

      isCorrect = correctBlanks === question.keywords.length;
    } else {
      isCorrect =
        normalizeAnswer(question.answerText) ===
        normalizeAnswer(studentAnswerText);
    }

    const answer = await prisma.$transaction(async (tx) => {
      // Delete existing answer if any
      await tx.quizAnswer.deleteMany({
        where: { quizAttemptId, quizQuestionId },
      });

      const newAnswer = await tx.quizAnswer.create({
        data: {
          quizAttemptId,
          quizQuestionId,
          answerText: studentAnswerText,
          isCorrect,
          ...(isBlankQuestion && {
            items: {
              create: preparedItems.map((item) => ({
                keywordId: item.keywordId,
                answerText: item.answerText,
                isCorrect: item.isCorrect,
              })),
            },
          }),
        },
      });

      return tx.quizAnswer.findUniqueOrThrow({
        where: { id: newAnswer.id },
        select: ANSWER_SELECT,
      });
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
      include: { keywords: true },
    });

    const questionMap = new Map(validQuestions.map((q) => [q.id, q]));

    const savedAnswers = await prisma.$transaction(async (tx) => {
      const results: AnswerRecord[] = [];

      for (const incoming of data.answers) {
        const questionId = BigInt(incoming.quizQuestionId);
        const question = questionMap.get(questionId);

        if (!question) {
          throw new QuizAttemptValidationError(
            `Question ID ${incoming.quizQuestionId} does not belong to the requested quiz.`,
          );
        }

        const isBlankQuestion = question.keywords.length > 0;
        let isCorrect = false;
        const preparedItems: {
          keywordId: bigint;
          answerText: string;
          isCorrect: boolean;
        }[] = [];
        const studentAnswerText = incoming.answerText ?? "";

        if (isBlankQuestion) {
          const submittedItems = incoming.items ?? [];
          let correctBlanks = 0;

          for (const kw of question.keywords) {
            const submitted = submittedItems.find(
              (item) => item.keywordId === kw.id.toString(),
            );
            const submittedText = submitted ? submitted.answerText : "";
            const correct =
              normalizeAnswer(kw.correctAnswer) ===
              normalizeAnswer(submittedText);
            if (correct) {
              correctBlanks++;
            }
            preparedItems.push({
              keywordId: kw.id,
              answerText: submittedText,
              isCorrect: correct,
            });
          }
          isCorrect = correctBlanks === question.keywords.length;
        } else {
          isCorrect =
            normalizeAnswer(question.answerText) ===
            normalizeAnswer(studentAnswerText);
        }

        // Delete existing answer
        await tx.quizAnswer.deleteMany({
          where: { quizAttemptId, quizQuestionId: questionId },
        });

        const newAnswer = await tx.quizAnswer.create({
          data: {
            quizAttemptId,
            quizQuestionId: questionId,
            answerText: studentAnswerText,
            isCorrect,
            ...(isBlankQuestion && {
              items: {
                create: preparedItems.map((item) => ({
                  keywordId: item.keywordId,
                  answerText: item.answerText,
                  isCorrect: item.isCorrect,
                })),
              },
            }),
          },
        });

        const loadedAnswer = await tx.quizAnswer.findUniqueOrThrow({
          where: { id: newAnswer.id },
          select: ANSWER_SELECT,
        });

        results.push(loadedAnswer);
      }

      return results;
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
      include: {
        quizQuestion: {
          include: { keywords: true },
        },
      },
    });

    const isBlankQuestion = existing.quizQuestion.keywords.length > 0;
    let isCorrect = false;
    const preparedItems: {
      keywordId: bigint;
      answerText: string;
      isCorrect: boolean;
    }[] = [];
    const studentAnswerText = data.answerText ?? existing.answerText;

    if (isBlankQuestion) {
      const submittedItems = data.items ?? [];
      let correctBlanks = 0;

      for (const kw of existing.quizQuestion.keywords) {
        const submitted = submittedItems.find(
          (item) => item.keywordId === kw.id.toString(),
        );
        const submittedText = submitted ? submitted.answerText : "";
        const correct =
          normalizeAnswer(kw.correctAnswer) === normalizeAnswer(submittedText);
        if (correct) {
          correctBlanks++;
        }
        preparedItems.push({
          keywordId: kw.id,
          answerText: submittedText,
          isCorrect: correct,
        });
      }
      isCorrect = correctBlanks === existing.quizQuestion.keywords.length;
    } else {
      isCorrect =
        normalizeAnswer(existing.quizQuestion.answerText) ===
        normalizeAnswer(studentAnswerText);
    }

    const answer = await prisma.$transaction(async (tx) => {
      if (isBlankQuestion) {
        // Delete old items
        await tx.quizAnswerItem.deleteMany({
          where: { quizAnswerId: answerId },
        });
      }

      return tx.quizAnswer.update({
        where: { id: answerId },
        data: {
          answerText: studentAnswerText,
          isCorrect,
          ...(isBlankQuestion && {
            items: {
              create: preparedItems.map((item) => ({
                keywordId: item.keywordId,
                answerText: item.answerText,
                isCorrect: item.isCorrect,
              })),
            },
          }),
        },
        select: ANSWER_SELECT,
      });
    });

    log.info(
      { answerId: answer.id.toString(), isCorrect },
      "Student answer updated",
    );
    return mapAnswer(answer);
  }
}
