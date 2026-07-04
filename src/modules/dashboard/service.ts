import { prisma } from "@/libs/prisma";
import type { Logger } from "pino";
import type { DashboardData } from "./model";

export abstract class DashboardService {
  static async getDashboard(log: Logger): Promise<DashboardData> {
    log.debug("Fetching dashboard data");

    const [
      totalUsers,
      activeUsers,
      totalRoles,
      totalFeatures,
      userDistribution,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.role.count(),
      prisma.feature.count(),
      prisma.role.findMany({
        select: {
          name: true,
          _count: {
            select: { users: true },
          },
        },
      }),
    ]);

    const inactiveUsers = totalUsers - activeUsers;

    const roleDistribution = userDistribution.map((role) => ({
      roleName: role.name,
      count: role._count.users,
    }));

    log.info(
      {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalRoles,
        totalFeatures,
        roleCount: roleDistribution.length,
      },
      "Dashboard data retrieved successfully",
    );

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalRoles,
      totalFeatures,
      userDistribution: roleDistribution,
    };
  }

  static async getLecturerDashboard(log: Logger) {
    log.debug("Fetching global lecturer dashboard data");

    // 1. Fetch top-level global stats and detailed breakdowns concurrently without lecturerId limits
    const [totalMaterials, totalQuizzes, totalAttemptsCount, materialsData] =
      await Promise.all([
        prisma.material.count(), // Global materials count
        prisma.quiz.count(), // Global quizzes count
        prisma.quizAttempt.count(), // ✅ Global attempts calculated directly at database level for maximum speed
        prisma.material.findMany({
          select: {
            id: true,
            title: true,
            materialType: true,
            quizzes: {
              select: {
                id: true,
                levels: {
                  select: {
                    id: true,
                  },
                },
                QuizAttempt: {
                  select: {
                    studentId: true, // Used to compute unique student engagement count per material
                  },
                },
              },
            },
          },
        }),
      ]);

    // 2. Map and aggregate metrics down per material
    const materialBreakdown = materialsData.map((material) => {
      let quizLevelCount = 0;
      const uniqueStudentsSet = new Set<string>();

      material.quizzes.forEach((quiz) => {
        quizLevelCount += quiz.levels.length;

        // Collate unique student IDs who have tried this material's quizzes
        quiz.QuizAttempt.forEach((attempt) => {
          uniqueStudentsSet.add(attempt.studentId);
        });
      });

      return {
        materialId: material.id.toString(),
        title: material.title,
        materialType: material.materialType,
        quizCount: material.quizzes.length,
        levelCount: quizLevelCount,
        uniqueStudentsEngaged: uniqueStudentsSet.size,
      };
    });

    log.info(
      { totalMaterials, totalQuizzes, totalAttemptsCount },
      "Global lecturer dashboard data compiled successfully",
    );

    return {
      overview: {
        totalMaterials,
        totalQuizzes,
        totalStudentAttempts: totalAttemptsCount,
      },
      materialBreakdown,
    };
  }

  static async getStudentDashboard(studentId: string, log: Logger) {
    log.debug({ studentId }, "Fetching student progression dashboard data");

    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId },
      include: {
        quizLevel: {
          select: {
            quiz: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalAttempts = attempts.length;
    const completedAttempts = attempts.filter((a) => a.submittedAt !== null);
    const inProgressAttempts = attempts.filter((a) => a.submittedAt === null);

    log.info(
      {
        studentId,
        totalAttempts,
        completed: completedAttempts.length,
      },
      "Student dashboard metrics processed successfully",
    );

    return {
      overview: {
        totalAttempts,
        quizzesCompleted: completedAttempts.length,
      },
      inProgress: inProgressAttempts.map((a) => ({
        attemptId: a.id.toString(),
        quizLevelId: a.quizLevelId.toString(),
        quizId: a.quizLevel.quiz.id.toString(),
        quizTitle: a.quizLevel.quiz.title,
        startedAt: a.createdAt.toISOString(),
      })),
      recentResults: completedAttempts.slice(0, 5).map((a) => ({
        attemptId: a.id.toString(),
        quizLevelId: a.quizLevelId.toString(), // ✅ Updated from quizId
        quizId: a.quizLevel.quiz.id.toString(), // ✅ Extracted safely from nested relation
        quizTitle: a.quizLevel.quiz.title, // ✅ Extracted safely from nested relation
        submittedAt: a.submittedAt!.toISOString(),
      })),
    };
  }

  static async getSummary(groupId: string, log: Logger) {
    log.debug({ groupId }, "Fetching dashboard summary");

    const total_students = await prisma.groupEnrollment.count({
      where: { groupId },
    });

    const total_materials = await prisma.material.count({
      where: { groupId },
    });

    return {
      group_id: groupId,
      total_students,
      avg_materials_read: 0.0,
      total_materials,
      avg_pass_rate: 0.0,
      pass_rate_trend: {
        current_week: 0.0,
        previous_week: 0.0,
        delta: 0.0,
      },
      generated_at: new Date().toISOString(),
    };
  }

  static async getContentHealth(groupId: string, log: Logger) {
    log.debug({ groupId }, "Fetching content health");

    const quizzes = await prisma.quiz.findMany({
      where: { groupId },
      select: { id: true, levelNumber: true, title: true },
    });

    const materials = await prisma.material.findMany({
      where: { groupId },
      select: { id: true, title: true },
    });

    return {
      quizzes: quizzes.map((q) => ({
        quiz_id: q.id.toString(),
        level: q.levelNumber,
        title: q.title,
        first_attempt_pass_rate: 0.0,
        avg_attempts_to_pass: 0.0,
        flag: null,
      })),
      materials: materials.map((m) => ({
        material_id: m.id.toString(),
        title: m.title,
        read_rate: 0.0,
        flag: null,
      })),
    };
  }
}
