import { prisma } from "@/libs/prisma";
import type { CreateMaterialInput } from "./schema";
import { Prisma } from "@generated/prisma";
import type { Logger } from "pino";
import { join } from "path";
import { mkdir } from "fs/promises";

export const SAFE_MATERIAL_SELECT = {
  id: true,
  lecturerId: true,
  groupId: true,
  sequence: true,
  version: true,
  title: true,
  description: true,
  materialType: true,
  content: true,
  sourceUrl: true,
  iconName: true,
  isPublished: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export abstract class MaterialService {
  static async getMaterials(
    params: {
      page: number;
      limit: number;
      lecturerId?: string;
      materialType?: string;
      isPublished?: boolean;
    },
    log: Logger,
  ) {
    log.debug(
      {
        page: params.page,
        limit: params.limit,
        lecturerId: params.lecturerId,
        materialType: params.materialType,
        isPublished: params.isPublished,
      },
      "Fetching materials list",
    );

    const { page, limit, lecturerId, materialType, isPublished } = params;

    const where: Prisma.MaterialWhereInput = {};

    if (lecturerId) {
      where.lecturerId = lecturerId;
    }

    if (materialType) {
      where.materialType = materialType;
    }

    if (typeof isPublished === "boolean") {
      where.isPublished = isPublished;
    }

    const skip = (page - 1) * limit;

    const [materials, total] = await prisma.$transaction([
      prisma.material.findMany({
        where,
        select: SAFE_MATERIAL_SELECT,
        skip,
        take: limit,
      }),
      prisma.material.count({ where }),
    ]);

    log.info(
      { count: materials.length, total },
      "Materials retrieved successfully",
    );

    const materialsWithStringDates = materials.map((material) => ({
      ...material,
      id: material.id.toString(),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      publishedAt: material.publishedAt?.toISOString() ?? null,
    }));

    return {
      materials: materialsWithStringDates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getMaterial(id: bigint, log: Logger) {
    log.debug({ materialId: id.toString() }, "Fetching material details");

    const material = await prisma.material.findUniqueOrThrow({
      where: { id },
      select: SAFE_MATERIAL_SELECT,
    });

    log.info(
      { materialId: id.toString(), title: material.title },
      "Material details retrieved successfully",
    );

    return {
      ...material,
      id: material.id.toString(),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      publishedAt: material.publishedAt?.toISOString() ?? null,
    };
  }

  static async createMaterial(data: CreateMaterialInput, log: Logger) {
    log.debug(
      { title: data.title, lecturerId: data.lecturerId },
      "Creating new material",
    );

    let sequence = data.sequence;
    if (sequence === undefined || sequence === null) {
      const lastMat = await prisma.material.findFirst({
        where: { groupId: data.groupId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      sequence = lastMat ? lastMat.sequence + 1000 : 1000;
    }

    const material = await prisma.material.create({
      data: {
        ...data,
        sequence,
        version: 1,
        publishedAt: data.isPublished ? new Date() : null,
      },
      select: SAFE_MATERIAL_SELECT,
    });

    log.info(
      { materialId: material.id.toString(), title: material.title },
      "Material created successfully",
    );

    return {
      ...material,
      id: material.id.toString(),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      publishedAt: material.publishedAt?.toISOString() ?? null,
    };
  }

  static async createMaterialMe(data: any, lecturerId: string, log: Logger) {
    let filePath: string | null = null;

    if (data.file instanceof File) {
      log.debug("Processing uploaded PDF file...");

      const uploadDir = join(process.cwd(), "storage", "materials");
      await mkdir(uploadDir, { recursive: true });
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const fileName = `${uniqueSuffix}-${data.file.name.replace(/\s+/g, "_")}`;
      const fullPath = join(uploadDir, fileName);

      const bytesWritten = await Bun.write(fullPath, data.file);
      log.debug(
        { bytesWritten, path: fullPath },
        "File saved to local storage",
      );

      filePath = `/storage/materials/${fileName}`;
    }

    let sequence = data.sequence;
    if (sequence === undefined || sequence === null) {
      const lastMat = await prisma.material.findFirst({
        where: { groupId: data.groupId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      sequence = lastMat ? lastMat.sequence + 1000 : 1000;
    }

    const material = await prisma.material.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        materialType: data.materialType,
        lecturerId: lecturerId,
        groupId: data.groupId,
        sequence,
        version: 1,
        content: filePath ?? data.content ?? null,
        sourceUrl: data.sourceUrl ?? null,
        iconName: data.iconName ?? null,
        publishedAt:
          data.isPublished === "true" || data.isPublished === true
            ? new Date()
            : null,
      },
      select: SAFE_MATERIAL_SELECT,
    });

    log.info(
      { materialId: material.id.toString(), title: material.title },
      "Material with attachment created successfully",
    );

    return {
      ...material,
      id: material.id.toString(),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      publishedAt: material.publishedAt?.toISOString() ?? null,
    };
  }

  static async updateMaterial(id: bigint, data: any, log: Logger) {
    log.debug(
      { materialId: id.toString() },
      "Updating material with optional attachment",
    );

    // 1. Fetch the existing record first to see if there is an old file we need to clean up
    const existingMaterial = await prisma.material.findUniqueOrThrow({
      where: { id },
      select: { content: true },
    });

    let filePath: string | null = existingMaterial.content;

    // 2. Process the newly uploaded file if present
    if (data.file instanceof File) {
      log.debug("Processing newly uploaded update PDF file...");

      const uploadDir = join(process.cwd(), "storage", "materials");
      await mkdir(uploadDir, { recursive: true });
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const fileName = `${uniqueSuffix}-${data.file.name.replace(/\s+/g, "_")}`;
      const fullPath = join(uploadDir, fileName);

      const bytesWritten = await Bun.write(fullPath, data.file);
      log.debug(
        { bytesWritten, path: fullPath },
        "New update file saved to local storage",
      );

      // 🧹 Clean up the previous physical file if it exists to avoid leaking storage
      if (
        existingMaterial.content &&
        existingMaterial.content.startsWith("/storage/materials/")
      ) {
        const oldFileFullPath = join(process.cwd(), existingMaterial.content);
        try {
          await Bun.file(oldFileFullPath).delete();
          log.debug(
            { oldPath: oldFileFullPath },
            "Old file deleted from local storage",
          );
        } catch (err) {
          log.warn(
            { oldPath: oldFileFullPath, err },
            "Failed to delete old file, continuing anyway",
          );
        }
      }

      filePath = `/storage/materials/${fileName}`;
    }

    // 3. Build atomic update mapping
    const updateData: Prisma.MaterialUpdateInput = {
      title: data.title !== undefined ? data.title : undefined,
      description:
        data.description !== undefined ? data.description : undefined,
      materialType:
        data.materialType !== undefined ? data.materialType : undefined,
      content:
        data.file instanceof File
          ? filePath
          : data.content !== undefined
            ? data.content
            : undefined,
      sourceUrl: data.sourceUrl !== undefined ? data.sourceUrl : undefined,
      iconName: data.iconName !== undefined ? data.iconName : undefined,
      sequence: data.sequence !== undefined ? data.sequence : undefined,
    };

    // 4. Handle publishing timestamp checks mirroring createMaterialMe string constraints
    if (data.isPublished !== undefined) {
      if (data.isPublished === "true" || data.isPublished === true) {
        updateData.publishedAt = new Date();
        updateData.isPublished = true;
      } else {
        updateData.publishedAt = null;
        updateData.isPublished = false;
      }
    }

    if (data.forceReread === true || data.forceReread === "true") {
      updateData.version = { increment: 1 };
    }

    const material = await prisma.material.update({
      where: { id },
      data: updateData,
      select: SAFE_MATERIAL_SELECT,
    });

    log.info(
      { materialId: id.toString(), title: material.title },
      "Material updated successfully with attachments",
    );

    return {
      ...material,
      id: material.id.toString(),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      publishedAt: material.publishedAt?.toISOString() ?? null,
    };
  }

  static async deleteMaterial(id: bigint, log: Logger) {
    log.debug({ materialId: id.toString() }, "Deleting material");

    const material = await prisma.material.delete({
      where: { id },
      select: SAFE_MATERIAL_SELECT,
    });

    log.info(
      { materialId: id.toString(), title: material.title },
      "Material deleted successfully",
    );

    return {
      ...material,
      id: material.id.toString(),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      publishedAt: material.publishedAt?.toISOString() ?? null,
    };
  }
}
