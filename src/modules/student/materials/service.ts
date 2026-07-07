import { prisma } from "@/libs/prisma";
import { MaterialNotFoundError } from "./error";
import type { Logger } from "pino";

export class StudentMaterialService {
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
}
