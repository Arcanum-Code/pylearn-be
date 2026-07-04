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
}
