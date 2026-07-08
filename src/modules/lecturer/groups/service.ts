import { prisma } from "@/libs/prisma";
import { Logger } from "pino";
import { LecturerGroupsError } from "./error";
import { StudentsActivityQuery } from "./schema";

export class LecturerGroupsService {
  static async getStudentsActivity(
    groupId: string,
    query: StudentsActivityQuery,
    log: Logger,
  ) {
    log.info({ groupId, query }, "Fetching students activity matrix for group");

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        materials: {
          select: { id: true, title: true, sequence: true },
          orderBy: { sequence: "asc" },
        },
        quizzes: {
          select: {
            id: true,
            title: true,
            levelNumber: true,
            passThreshold: true,
          },
          orderBy: { levelNumber: "asc" },
        },
        enrollments: {
          select: {
            createdAt: true,
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                MaterialRead: {
                  where: { material: { groupId } },
                  select: {
                    materialId: true,
                    scrollPercentage: true,
                    readAt: true,
                    updatedAt: true,
                  },
                },
                QuizAttempt: {
                  where: { quiz: { groupId } },
                  select: {
                    id: true,
                    quizId: true,
                    score: true,
                    attemptNumber: true,
                    startedAt: true,
                    submittedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new LecturerGroupsError(404, "common.notFound");
    }

    const totalMaterials = group.materials.length;
    const _totalQuizzes = group.quizzes.length;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Preliminary calculation for class averages
    let totalProgressSum = 0;
    let totalQuizScoreSum = 0;

    const rawStudents = group.enrollments.map((enrollment) => {
      const student = enrollment.student;

      // Materials progress
      let completedMaterialsCount = 0;
      const materialsProgress = group.materials.map((mat) => {
        const read = student.MaterialRead.find((r) => r.materialId === mat.id);
        const scrollPercentage = read?.scrollPercentage ?? 0;
        const isCompleted = scrollPercentage === 100 || read?.readAt != null;
        if (isCompleted) {
          completedMaterialsCount++;
        }

        let status = "not_started";
        if (isCompleted) {
          status = "completed";
        } else if (scrollPercentage > 0) {
          status = "in_progress";
        }

        return {
          material_id: String(mat.id),
          status,
          scroll_percentage: scrollPercentage,
          last_read_at: read?.readAt ? read.readAt.toISOString() : null,
        };
      });

      const overallProgressPercentage =
        totalMaterials > 0
          ? Math.round((completedMaterialsCount / totalMaterials) * 100 * 10) /
            10
          : 0;

      // Quizzes progress
      let attemptedQuizzesCount = 0;
      let quizScoreSum = 0;

      const quizzesProgress = group.quizzes.map((q) => {
        const attempts = student.QuizAttempt.filter((a) => a.quizId === q.id);
        const attemptsCount = attempts.length;

        let bestScore: number | null = null;
        let lastAttemptAt: string | null = null;
        let status = "not_attempted";

        if (attemptsCount > 0) {
          attemptedQuizzesCount++;
          const scores = attempts
            .map((a) => a.score)
            .filter((s): s is number => s != null);
          bestScore = scores.length > 0 ? Math.max(...scores) : null;

          if (bestScore != null) {
            quizScoreSum += bestScore;
            status = bestScore >= q.passThreshold ? "passed" : "failed";
          } else {
            status = "failed";
          }

          const timestamps = attempts.map((a) =>
            (a.submittedAt || a.startedAt).getTime(),
          );
          const latestTs = Math.max(...timestamps);
          lastAttemptAt = new Date(latestTs).toISOString();
        }

        return {
          quiz_id: String(q.id),
          status,
          best_score: bestScore,
          attempts_count: attemptsCount,
          last_attempt_at: lastAttemptAt,
        };
      });

      const avgQuizScore =
        attemptedQuizzesCount > 0
          ? Math.round((quizScoreSum / attemptedQuizzesCount) * 10) / 10
          : 0;

      // Last active calculation
      const activeTimestamps: number[] = [];
      student.MaterialRead.forEach((r) => {
        if (r.readAt) activeTimestamps.push(r.readAt.getTime());
        if (r.updatedAt) activeTimestamps.push(r.updatedAt.getTime());
      });
      student.QuizAttempt.forEach((a) => {
        if (a.startedAt) activeTimestamps.push(a.startedAt.getTime());
        if (a.submittedAt) activeTimestamps.push(a.submittedAt.getTime());
      });

      const lastActiveAt =
        activeTimestamps.length > 0
          ? new Date(Math.max(...activeTimestamps)).toISOString()
          : null;

      totalProgressSum += overallProgressPercentage;
      totalQuizScoreSum += avgQuizScore;

      return {
        student_id: student.id,
        name: student.name || "",
        email: student.email,
        avatar_url: null,
        overall_progress_percentage: overallProgressPercentage,
        avg_quiz_score: avgQuizScore,
        last_active_at: lastActiveAt,
        materials_progress: materialsProgress,
        quizzes_progress: quizzesProgress,
      };
    });

    const totalStudents = rawStudents.length;
    const avgClassProgress =
      totalStudents > 0
        ? Math.round((totalProgressSum / totalStudents) * 10) / 10
        : 0;
    const avgClassQuizScore =
      totalStudents > 0
        ? Math.round((totalQuizScoreSum / totalStudents) * 10) / 10
        : 0;

    let atRiskCount = 0;
    let inactiveCount = 0;
    let onTrackCount = 0;

    const studentsWithStatus = rawStudents.map((student) => {
      const statusReasons: string[] = [];
      let isAtRisk = false;

      // Check AT_RISK conditions
      if (
        student.avg_quiz_score < 60 &&
        student.quizzes_progress.some((q) => q.attempts_count > 0)
      ) {
        isAtRisk = true;
        statusReasons.push(
          `Rata-rata nilai kuis di bawah 60 (${student.avg_quiz_score})`,
        );
      }

      student.quizzes_progress.forEach((qp) => {
        const quizObj = group.quizzes.find((q) => String(q.id) === qp.quiz_id);
        if (qp.attempts_count >= 3 && qp.status !== "passed") {
          isAtRisk = true;
          statusReasons.push(
            `Mengulang ${quizObj?.title || "kuis"} sebanyak ${qp.attempts_count} kali`,
          );
        } else if (
          qp.attempts_count > 0 &&
          qp.best_score != null &&
          quizObj &&
          qp.best_score < quizObj.passThreshold
        ) {
          statusReasons.push(
            `Nilai ${quizObj.title} di bawah batas kelulusan (${qp.best_score}/${quizObj.passThreshold})`,
          );
        }
      });

      let status = "ON_TRACK";
      if (isAtRisk) {
        status = "AT_RISK";
        atRiskCount++;
      } else {
        // Check INACTIVE
        const lastActiveDate = student.last_active_at
          ? new Date(student.last_active_at)
          : null;
        const isOlderThan7Days =
          !lastActiveDate || lastActiveDate < sevenDaysAgo;
        const isLowProgress =
          student.overall_progress_percentage < 20 && avgClassProgress > 50;

        if (isOlderThan7Days || isLowProgress) {
          status = "INACTIVE";
          inactiveCount++;
          if (isOlderThan7Days) {
            statusReasons.push("Belum aktif selama 7 hari terakhir");
          }
          if (isLowProgress) {
            statusReasons.push(
              `Progres keseluruhan di bawah 20% (${student.overall_progress_percentage}%) sedangkan rata-rata kelas ${avgClassProgress}%`,
            );
          }
        } else {
          status = "ON_TRACK";
          onTrackCount++;
          if (statusReasons.length === 0) {
            statusReasons.push("Progres dan nilai kuis dalam kondisi baik");
          }
        }
      }

      return {
        ...student,
        status,
        status_reasons: statusReasons,
      };
    });

    // Filtering & Sorting
    let filteredStudents = studentsWithStatus;
    if (query.status && query.status !== "ALL") {
      filteredStudents = filteredStudents.filter(
        (s) => s.status === query.status,
      );
    }
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredStudents = filteredStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.email.toLowerCase().includes(searchLower),
      );
    }

    if (query.sortBy) {
      const orderMultiplier = query.sortOrder === "desc" ? -1 : 1;
      filteredStudents.sort((a, b) => {
        if (query.sortBy === "name") {
          return orderMultiplier * a.name.localeCompare(b.name);
        } else if (query.sortBy === "progress") {
          return (
            orderMultiplier *
            (a.overall_progress_percentage - b.overall_progress_percentage)
          );
        } else if (query.sortBy === "quiz_score") {
          return orderMultiplier * (a.avg_quiz_score - b.avg_quiz_score);
        } else if (query.sortBy === "last_active") {
          const timeA = a.last_active_at
            ? new Date(a.last_active_at).getTime()
            : 0;
          const timeB = b.last_active_at
            ? new Date(b.last_active_at).getTime()
            : 0;
          return orderMultiplier * (timeA - timeB);
        }
        return 0;
      });
    }

    return {
      summary: {
        total_students: totalStudents,
        at_risk_count: atRiskCount,
        inactive_count: inactiveCount,
        on_track_count: onTrackCount,
        avg_class_progress: avgClassProgress,
        avg_class_quiz_score: avgClassQuizScore,
      },
      columns: {
        materials: group.materials.map((m) => ({
          id: String(m.id),
          title: m.title,
          order: m.sequence,
        })),
        quizzes: group.quizzes.map((q) => ({
          id: String(q.id),
          title: q.title,
          level_number: q.levelNumber,
        })),
      },
      students: filteredStudents,
    };
  }

  static async getStudentActivityDetail(
    groupId: string,
    studentId: string,
    log: Logger,
  ) {
    log.info(
      { groupId, studentId },
      "Fetching granular student activity detail",
    );

    const enrollment = await prisma.groupEnrollment.findUnique({
      where: {
        groupId_studentId: { groupId, studentId },
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!enrollment) {
      throw new LecturerGroupsError(404, "common.notFound");
    }

    const [quizAttempts, materialReads] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: {
          studentId,
          quiz: { groupId },
        },
        include: {
          quiz: { select: { id: true, title: true, passThreshold: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.materialRead.findMany({
        where: {
          studentId,
          material: { groupId },
        },
        include: {
          material: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const quizAttemptsHistory = quizAttempts.map((attempt) => {
      let status = "in_progress";
      if (attempt.score != null && attempt.submittedAt != null) {
        status =
          attempt.score >= attempt.quiz.passThreshold ? "passed" : "failed";
      }

      let timeSpentSeconds: number | null = null;
      if (attempt.submittedAt && attempt.startedAt) {
        timeSpentSeconds = Math.round(
          (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
        );
      }

      return {
        attempt_id: String(attempt.id),
        quiz_id: String(attempt.quizId),
        quiz_title: attempt.quiz.title,
        attempt_number: attempt.attemptNumber,
        score: attempt.score ?? null,
        status,
        started_at: attempt.startedAt.toISOString(),
        submitted_at: attempt.submittedAt
          ? attempt.submittedAt.toISOString()
          : null,
        time_spent_seconds: timeSpentSeconds,
      };
    });

    const materialReadingTimeline = materialReads.map((read) => {
      const scrollPercentage = read.scrollPercentage ?? 0;
      let status = "not_started";
      if (scrollPercentage === 100 || read.readAt != null) {
        status = "completed";
      } else if (scrollPercentage > 0) {
        status = "in_progress";
      }

      return {
        material_id: String(read.materialId),
        material_title: read.material.title,
        status,
        scroll_percentage: scrollPercentage,
        first_opened_at: read.createdAt.toISOString(),
        completed_at: read.readAt ? read.readAt.toISOString() : null,
      };
    });

    return {
      student: {
        student_id: enrollment.student.id,
        name: enrollment.student.name || "",
        email: enrollment.student.email,
        enrolled_at: enrollment.createdAt.toISOString(),
      },
      quiz_attempts_history: quizAttemptsHistory,
      material_reading_timeline: materialReadingTimeline,
    };
  }
}
