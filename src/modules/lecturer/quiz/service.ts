import { prisma } from "@/libs/prisma";
import { LecturerQuizError } from "./error";
import type { Logger } from "pino";

export class LecturerQuizService {
  static async createQuiz(
    groupId: string,
    data: { level: number; title: string; pass_threshold: number },
    userId: string,
    log: Logger,
  ) {
    const existing = await prisma.quiz.findUnique({
      where: { groupId_levelNumber: { groupId, levelNumber: data.level } },
    });

    if (existing) {
      throw new LecturerQuizError(422, "quiz.levelExists", {
        quiz_id: existing.id.toString(),
        title: existing.title,
      });
    }

    const quiz = await prisma.quiz.create({
      data: {
        groupId,
        levelNumber: data.level,
        title: data.title,
        passThreshold: data.pass_threshold,
        isPublished: false,
      },
    });

    log.info({ quizId: quiz.id }, "Lecturer created new quiz draft");

    return {
      quiz_id: `qz_${quiz.id}`,
      group_id: quiz.groupId,
      level: quiz.levelNumber,
      title: quiz.title,
      pass_threshold: quiz.passThreshold,
      status: quiz.isPublished ? "published" : "draft",
      questions: [],
    };
  }

  static async updateQuiz(
    quizIdStr: string,
    data: { level?: number; title?: string; pass_threshold?: number },
    log: Logger,
  ) {
    const id = BigInt(quizIdStr.replace("qz_", ""));
    const existing = await prisma.quiz.findUnique({
      where: { id },
      include: { _count: { select: { QuizAttempt: true } } },
    });

    if (!existing) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    if (data.level !== undefined && data.level !== existing.levelNumber) {
      const levelConflict = await prisma.quiz.findUnique({
        where: {
          groupId_levelNumber: {
            groupId: existing.groupId,
            levelNumber: data.level,
          },
        },
      });
      if (levelConflict) {
        throw new LecturerQuizError(422, "quiz.levelExists", {
          quiz_id: `qz_${levelConflict.id}`,
          title: levelConflict.title,
        });
      }
    }

    const quiz = await prisma.quiz.update({
      where: { id },
      data: {
        levelNumber: data.level,
        title: data.title,
        passThreshold: data.pass_threshold,
      },
    });

    log.info({ quizId: quiz.id }, "Lecturer updated quiz metadata");

    let warning: string | undefined;
    if (existing._count.QuizAttempt > 0) {
      warning = `This quiz has ${existing._count.QuizAttempt} existing attempts; past scores will not be recalculated.`;
    }

    return {
      quiz_id: `qz_${quiz.id}`,
      group_id: quiz.groupId,
      level: quiz.levelNumber,
      title: quiz.title,
      pass_threshold: quiz.passThreshold,
      status: quiz.isPublished ? "published" : "draft",
      questions: [],
      warning,
    };
  }

  static async createQuestion(
    quizIdStr: string,
    data: {
      question_text: string;
      key_answer_text: string;
      sequence_order: number;
    },
    log: Logger,
  ) {
    const quizId = BigInt(quizIdStr.replace("qz_", ""));

    // Check if quiz exists
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    // Check for sequence_order conflict
    const sequenceConflict = await prisma.quizQuestion.findUnique({
      where: {
        quizId_questionOrder: { quizId, questionOrder: data.sequence_order },
      },
    });

    if (sequenceConflict) {
      throw new LecturerQuizError(422, "quiz.questionOrderExists", {
        sequence_order: data.sequence_order,
      });
    }

    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
        questionText: data.question_text,
        answerText: data.key_answer_text,
        questionOrder: data.sequence_order,
      },
    });

    log.info(
      { questionId: question.id, quizId },
      "Lecturer added question to quiz",
    );

    return {
      question_id: `q_${question.id}`,
      quiz_id: quizIdStr,
      question_text: question.questionText,
      key_answer_text: question.answerText,
      sequence_order: question.questionOrder,
      blanks: [],
    };
  }

  static async replaceBlanks(
    questionIdStr: string,
    data: {
      blanks: { keyword: string; start_index: number; end_index: number }[];
    },
    log: Logger,
  ) {
    const questionId = BigInt(questionIdStr.replace("q_", ""));

    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    // Validate that each blank exactly matches the answerText substring
    for (const blank of data.blanks) {
      if (
        blank.start_index >= blank.end_index ||
        blank.end_index > question.answerText.length
      ) {
        throw new LecturerQuizError(422, "quiz.invalidBlankIndices", { blank });
      }
      const actualSubstring = question.answerText.substring(
        blank.start_index,
        blank.end_index,
      );
      if (actualSubstring !== blank.keyword) {
        throw new LecturerQuizError(422, "quiz.blankMismatch", {
          expected: blank.keyword,
          actual: actualSubstring,
        });
      }
    }

    // Sort blanks by start_index to guarantee sequential blankOrder
    const sortedBlanks = [...data.blanks].sort(
      (a, b) => a.start_index - b.start_index,
    );

    // Run delete + inserts in a transaction to return IDs safely
    const createdBlanks = await prisma.$transaction(async (tx) => {
      await tx.questionKeyword.deleteMany({ where: { questionId } });

      const results = [];
      for (let i = 0; i < sortedBlanks.length; i++) {
        const blank = sortedBlanks[i];
        const newBlank = await tx.questionKeyword.create({
          data: {
            questionId,
            blankOrder: i + 1,
            correctAnswer: blank.keyword,
            startIndex: blank.start_index,
            endIndex: blank.end_index,
          },
        });
        results.push(newBlank);
      }
      return results;
    });

    log.info(
      { questionId: question.id, blanksCount: createdBlanks.length },
      "Lecturer replaced question blanks",
    );

    return {
      question_id: questionIdStr,
      blanks: createdBlanks.map((b) => ({
        blank_id: `b_${b.id}`,
        keyword: b.correctAnswer,
        start_index: b.startIndex,
        end_index: b.endIndex,
      })),
    };
  }

  static async updateQuestion(
    questionIdStr: string,
    data: {
      question_text?: string;
      key_answer_text?: string;
      sequence_order?: number;
    },
    log: Logger,
  ) {
    const questionId = BigInt(questionIdStr.replace("q_", ""));

    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: { keywords: true },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    if (
      data.sequence_order !== undefined &&
      data.sequence_order !== question.questionOrder
    ) {
      const sequenceConflict = await prisma.quizQuestion.findUnique({
        where: {
          quizId_questionOrder: {
            quizId: question.quizId,
            questionOrder: data.sequence_order,
          },
        },
      });
      if (sequenceConflict) {
        throw new LecturerQuizError(422, "quiz.questionOrderExists", {
          sequence_order: data.sequence_order,
        });
      }
    }

    const updatedQuestion = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        questionText:
          data.question_text !== undefined ? data.question_text : undefined,
        answerText:
          data.key_answer_text !== undefined ? data.key_answer_text : undefined,
        questionOrder:
          data.sequence_order !== undefined ? data.sequence_order : undefined,
      },
    });

    let blanksInvalidated = false;
    let message: string | undefined = undefined;

    if (
      data.key_answer_text !== undefined &&
      data.key_answer_text !== question.answerText &&
      question.keywords.length > 0
    ) {
      for (const blank of question.keywords) {
        if (
          blank.startIndex >= blank.endIndex ||
          blank.endIndex > data.key_answer_text.length
        ) {
          blanksInvalidated = true;
          break;
        }
        const actualSubstring = data.key_answer_text.substring(
          blank.startIndex,
          blank.endIndex,
        );
        if (actualSubstring !== blank.correctAnswer) {
          blanksInvalidated = true;
          break;
        }
      }
    }

    if (blanksInvalidated) {
      message = "Key answer changed; please re-select blanks.";
    }

    log.info({ questionId: updatedQuestion.id }, "Lecturer updated question");

    return {
      question_id: questionIdStr,
      quiz_id: `qz_${updatedQuestion.quizId}`,
      question_text: updatedQuestion.questionText,
      key_answer_text: updatedQuestion.answerText,
      sequence_order: updatedQuestion.questionOrder,
      blanks: question.keywords.map((b) => ({
        blank_id: `b_${b.id}`,
        keyword: b.correctAnswer,
        start_index: b.startIndex,
        end_index: b.endIndex,
      })),
      blanks_invalidated: blanksInvalidated ? true : undefined,
      message,
    };
  }

  static async deleteQuestion(questionIdStr: string, log: Logger) {
    const questionId = BigInt(questionIdStr.replace("q_", ""));

    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    await prisma.quizQuestion.delete({ where: { id: questionId } });

    log.info(
      { questionId: question.id },
      "Lecturer deleted question (and cascaded blanks)",
    );
  }
}
