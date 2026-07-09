import { prisma } from "@/libs/prisma";
import { GroupNotFoundError } from "@/modules/group/error";
import type { Logger } from "pino";

export class StudentGroupService {
  static async getGroupMaterials(
    groupId: string,
    studentId: string,
    log: Logger,
  ) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        materials: {
          orderBy: { sequence: "asc" },
          where: { publishedAt: { lte: new Date() } },
          include: {
            reads: {
              where: { studentId },
            },
          },
        },
        quizzes: {
          where: { isPublished: true },
          orderBy: { levelNumber: "asc" },
          include: {
            QuizAttempt: {
              where: { studentId },
              orderBy: { score: "desc" },
            },
          },
        },
      },
    });

    const locale = (log.bindings()?.locale as string) || "en";
    if (!group) throw new GroupNotFoundError(locale);

    let completedCount = 0;
    const materials = group.materials.map((mat) => {
      const read = mat.reads[0];
      let status = "not_started";
      let completed_at = null;

      if (read) {
        if (read.readAt) {
          status = "completed";
          completed_at = read.readAt.toISOString();
          completedCount++;
        } else {
          status = "in_progress";
        }
      }

      return {
        material_id: mat.id.toString(),
        title: mat.title,
        sequence_order: mat.sequence,
        status,
        completed_at,
      };
    });

    const quizzes = (group.quizzes || []).map((quiz) => {
      const attempts = quiz.QuizAttempt;
      const hasSubmitted = attempts.some((a) => a.submittedAt !== null);
      const hasInProgress = attempts.some((a) => a.submittedAt === null);
      let status = "not_started";

      if (hasSubmitted) {
        status = "completed";
      } else if (hasInProgress) {
        status = "in_progress";
      }

      const submittedAttempts = attempts.filter(
        (a) => a.submittedAt !== null && a.score !== null,
      );
      const bestScore =
        submittedAttempts.length > 0
          ? Math.max(...submittedAttempts.map((a) => a.score!))
          : null;

      const isPassed =
        bestScore !== null ? bestScore >= quiz.passThreshold : null;

      return {
        quiz_id: quiz.id.toString(),
        title: quiz.title,
        level_number: quiz.levelNumber,
        status,
        pass_threshold: quiz.passThreshold,
        is_passed: isPassed,
        best_score: bestScore,
        deadline: quiz.endTime ? quiz.endTime.toISOString() : null,
      };
    });

    return {
      group_id: group.id,
      group_name: group.name,
      materials,
      quizzes,
      progress: {
        completed: completedCount,
        total: materials.length,
      },
    };
  }

  static async getStudentGroupDetail(
    groupId: string,
    studentId: string,
    log: Logger,
  ) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        materials: {
          where: {
            publishedAt: { lte: new Date() },
          },
          include: {
            lecturer: {
              select: {
                name: true,
              },
            },
            reads: {
              where: { studentId },
            },
          },
          orderBy: { sequence: "asc" },
        },
        quizzes: {
          where: {
            isPublished: true,
          },
          include: {
            QuizAttempt: {
              where: { studentId },
              orderBy: { score: "desc" },
            },
          },
          orderBy: { levelNumber: "asc" },
        },
      },
    });

    const locale = (log.bindings()?.locale as string) || "en";
    if (!group) throw new GroupNotFoundError(locale);

    const firstMaterialWithLecturer = group.materials.find(
      (m) => m.lecturer && m.lecturer.name,
    );
    const lecturerName =
      firstMaterialWithLecturer?.lecturer?.name || "Unknown Lecturer";

    let materialsCompleted = 0;
    const materialItems = group.materials.map((mat) => {
      const read = mat.reads[0];
      let status: "not_started" | "in_progress" | "completed" = "not_started";
      if (read) {
        if (read.readAt) {
          status = "completed";
          materialsCompleted++;
        } else {
          status = "in_progress";
        }
      }
      return {
        type: "material" as const,
        id: mat.id.toString(),
        title: mat.title,
        description: mat.description || "",
        status,
        scrollPercentage: read ? read.scrollPercentage : null,
        order: mat.sequence,
      };
    });

    const quizItems = group.quizzes.map((quiz) => {
      const attempts = quiz.QuizAttempt;
      const hasSubmitted = attempts.some((a) => a.submittedAt !== null);
      const hasInProgress = attempts.some((a) => a.submittedAt === null);
      let status: "not_started" | "in_progress" | "completed" = "not_started";

      if (hasSubmitted) {
        status = "completed";
      } else if (hasInProgress) {
        status = "in_progress";
      }

      const submittedAttempts = attempts.filter(
        (a) => a.submittedAt !== null && a.score !== null,
      );
      const bestScore =
        submittedAttempts.length > 0
          ? Math.max(...submittedAttempts.map((a) => a.score!))
          : null;

      const isPassed =
        bestScore !== null ? bestScore >= quiz.passThreshold : null;

      return {
        type: "quiz" as const,
        id: quiz.id.toString(),
        title: quiz.title,
        description: quiz.description || "",
        status,
        deadline: quiz.endTime ? quiz.endTime.toISOString() : null,
        bestScore,
        passThreshold: quiz.passThreshold,
        isPassed,
        order: quiz.levelNumber,
      };
    });

    const items = [...materialItems, ...quizItems].sort(
      (a, b) => a.order - b.order,
    );

    const materialsTotal = group.materials.length;
    const percentage =
      materialsTotal > 0
        ? Math.round((materialsCompleted / materialsTotal) * 100)
        : 0;

    return {
      groupId: group.id,
      groupName: group.name,
      description: group.description,
      lecturerName,
      progress: {
        materialsCompleted,
        materialsTotal,
        percentage,
      },
      items,
    };
  }
}
