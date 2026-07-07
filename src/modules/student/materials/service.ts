import { prisma } from "@/libs/prisma";
import { GroupNotFoundError } from "@/modules/group/error";
import { MaterialNotFoundError } from "./error";
import type { Logger } from "pino";

export class StudentMaterialService {
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

    return {
      group_id: group.id,
      group_name: group.name,
      materials,
      progress: {
        completed: completedCount,
        total: materials.length,
      },
    };
  }

  static async getMaterialDetail(
    materialId: bigint,
    studentId: string,
    log: Logger,
  ) {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        group: {
          include: {
            materials: {
              orderBy: { sequence: "asc" },
              where: { publishedAt: { lte: new Date() } },
              select: { id: true, sequence: true },
            },
          },
        },
        reads: {
          where: { studentId },
        },
      },
    });

    const locale = (log.bindings()?.locale as string) || "en";
    if (!material) throw new MaterialNotFoundError(locale);

    if (material.publishedAt === null || material.publishedAt > new Date()) {
      throw new MaterialNotFoundError(locale);
    }

    // Auto-create progress row if it doesn't exist
    let read = material.reads[0];
    if (!read) {
      read = await prisma.materialRead.create({
        data: {
          materialId: material.id,
          studentId: studentId,
          materialVersion: material.version,
          // readAt is null by default, meaning in_progress
        },
      });
    }

    let status = "not_started";
    if (read) {
      status = read.readAt ? "completed" : "in_progress";
    }

    // Determine navigation
    const groupMaterials = material.group.materials;
    const currentIndex = groupMaterials.findIndex((m) => m.id === material.id);
    const prev =
      currentIndex > 0 ? groupMaterials[currentIndex - 1].id.toString() : null;
    const next =
      currentIndex < groupMaterials.length - 1
        ? groupMaterials[currentIndex + 1].id.toString()
        : null;

    return {
      material_id: material.id.toString(),
      group_id: material.groupId,
      title: material.title,
      content: material.content,
      attachment_url: material.sourceUrl, // Re-using sourceUrl for attachment per existing schema
      sequence_order: material.sequence,
      status,
      scroll_percentage: read ? read.scrollPercentage : null,
      navigation: {
        prev_material_id: prev,
        next_material_id: next,
      },
    };
  }

  static async updateProgress(
    materialId: bigint,
    studentId: string,
    payload: { status: string; scroll_percentage?: number },
    log: Logger,
  ) {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });

    const locale = (log.bindings()?.locale as string) || "en";
    if (!material) throw new MaterialNotFoundError(locale);

    if (material.publishedAt === null || material.publishedAt > new Date()) {
      throw new MaterialNotFoundError(locale);
    }

    const existingRead = await prisma.materialRead.findUnique({
      where: {
        studentId_materialId: {
          studentId,
          materialId,
        },
      },
    });

    // If it's already completed, it's idempotent, do nothing but return it.
    if (existingRead && existingRead.readAt) {
      return {
        material_id: material.id.toString(),
        status: "completed",
        scroll_percentage: existingRead.scrollPercentage,
        completed_at: existingRead.readAt.toISOString(),
      };
    }

    const dataToUpdate: any = {
      materialVersion: material.version,
    };

    if (payload.status === "completed") {
      dataToUpdate.readAt = new Date();
    }
    if (payload.scroll_percentage !== undefined) {
      dataToUpdate.scrollPercentage = payload.scroll_percentage;
    }

    const updatedRead = await prisma.materialRead.upsert({
      where: {
        studentId_materialId: { studentId, materialId },
      },
      update: dataToUpdate,
      create: {
        studentId,
        materialId,
        materialVersion: material.version,
        readAt: payload.status === "completed" ? new Date() : null,
        scrollPercentage: payload.scroll_percentage ?? null,
      },
    });

    return {
      material_id: material.id.toString(),
      status: updatedRead.readAt ? "completed" : "in_progress",
      scroll_percentage: updatedRead.scrollPercentage,
      completed_at: updatedRead.readAt
        ? updatedRead.readAt.toISOString()
        : null,
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

      return {
        type: "quiz" as const,
        id: quiz.id.toString(),
        title: quiz.title,
        description: quiz.description || "",
        status,
        deadline: quiz.endTime ? quiz.endTime.toISOString() : null,
        bestScore,
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
