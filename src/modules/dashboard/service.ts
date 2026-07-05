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
    const [
      totalMaterials,
      totalQuizzes,
      totalAttemptsCount,
      materialsData,
      quizzesData,
      groupsData,
    ] = await Promise.all([
      prisma.material.count(), // Global materials count
      prisma.quiz.count(), // Global quizzes count
      prisma.quizAttempt.count(), // ✅ Global attempts calculated directly at database level for maximum speed
      prisma.material.findMany({
        select: {
          id: true,
          title: true,
          materialType: true,
          groupId: true,
        },
      }),
      prisma.quiz.findMany({
        select: {
          id: true,
          groupId: true,
          levelNumber: true,
          QuizAttempt: {
            select: {
              studentId: true,
            },
          },
        },
      }),
      prisma.group.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: { enrollments: true },
          },
          quizzes: {
            select: {
              passThreshold: true,
              QuizAttempt: {
                select: {
                  score: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // 2. Map and aggregate metrics down per material
    const materialBreakdown = materialsData.map((material) => {
      const groupQuizzes = quizzesData.filter(
        (q) => q.groupId === material.groupId,
      );
      const uniqueStudentsSet = new Set<string>();

      groupQuizzes.forEach((quiz) => {
        // Collate unique student IDs who have tried this material's group's quizzes
        quiz.QuizAttempt.forEach((attempt) => {
          uniqueStudentsSet.add(attempt.studentId);
        });
      });

      return {
        materialId: material.id.toString(),
        title: material.title,
        materialType: material.materialType,
        quizCount: groupQuizzes.length,
        levelCount: groupQuizzes.length,
        uniqueStudentsEngaged: uniqueStudentsSet.size,
      };
    });

    const groupsOverview = groupsData.map((group) => {
      let groupTotalAttempts = 0;
      let passedAttempts = 0;
      let scoredAttemptsCount = 0;

      group.quizzes.forEach((quiz) => {
        groupTotalAttempts += quiz.QuizAttempt.length;

        quiz.QuizAttempt.forEach((attempt) => {
          if (attempt.score !== null) {
            scoredAttemptsCount++;
            if (attempt.score >= quiz.passThreshold) {
              passedAttempts++;
            }
          }
        });
      });

      const avgPassRate =
        scoredAttemptsCount > 0
          ? Number(((passedAttempts / scoredAttemptsCount) * 100).toFixed(1))
          : 0;

      return {
        groupId: group.id,
        groupName: group.name,
        totalStudents: group._count.enrollments,
        avgPassRate,
        totalStudentAttempts: groupTotalAttempts,
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
      groupsOverview,
      materialBreakdown,
    };
  }

  static async getStudentDashboard(studentId: string, log: Logger) {
    log.debug({ studentId }, "Fetching student progression dashboard data");

    const [attempts, enrollments] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { studentId },
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.groupEnrollment.findMany({
        where: { studentId },
        include: {
          group: {
            include: {
              materials: {
                include: {
                  reads: {
                    where: { studentId },
                  },
                },
                orderBy: { sequence: "asc" },
              },
            },
          },
        },
      }),
    ]);

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

    const enrolledGroups = enrollments.map((enrollment) => {
      let materialsCompleted = 0;
      const materials = enrollment.group.materials.map((mat) => {
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
          materialId: mat.id.toString(),
          title: mat.title,
          status,
          scrollPercentage: read ? read.scrollPercentage : null,
        };
      });

      return {
        groupId: enrollment.group.id,
        groupName: enrollment.group.name,
        materialsCompleted,
        materialsTotal: materials.length,
        materials,
      };
    });

    return {
      overview: {
        totalAttempts,
        quizzesCompleted: completedAttempts.length,
      },
      inProgress: inProgressAttempts.map((a) => ({
        attemptId: a.id.toString(),
        quizId: a.quiz.id.toString(),
        quizTitle: a.quiz.title,
        startedAt: a.createdAt.toISOString(),
      })),
      recentResults: completedAttempts.slice(0, 5).map((a) => ({
        attemptId: a.id.toString(),
        quizId: a.quiz.id.toString(),
        quizTitle: a.quiz.title,
        submittedAt: a.submittedAt!.toISOString(),
      })),
      enrolledGroups,
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
