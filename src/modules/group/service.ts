import { prisma } from "@/libs/prisma";
import type { CreateGroupInput, UpdateGroupInput } from "./schema";
import type { Logger } from "pino";
import { GroupNotFoundError } from "./error";

export abstract class GroupService {
  static async createGroup(data: CreateGroupInput, log: Logger) {
    log.debug({ name: data.name }, "Creating group");
    const group = await prisma.group.create({ data });
    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  static async getGroups(log: Logger) {
    log.debug("Fetching all groups");
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: "desc" },
    });
    return groups.map((group) => ({
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }));
  }

  static async getGroupById(id: string, log: Logger) {
    log.debug({ id }, "Fetching group details");
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        materials: {
          orderBy: { sequence: "asc" },
        },
        quizzes: {
          orderBy: { levelNumber: "asc" },
        },
      },
    });

    if (!group) {
      throw new GroupNotFoundError();
    }

    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      materials: group.materials.map((m) => ({
        ...m,
        id: m.id.toString(),
      })),
      quizzes: group.quizzes.map((q) => ({
        ...q,
        id: q.id.toString(),
      })),
    };
  }

  static async updateGroup(id: string, data: UpdateGroupInput, log: Logger) {
    log.debug({ id, data }, "Updating group");

    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) {
      throw new GroupNotFoundError();
    }

    const group = await prisma.group.update({
      where: { id },
      data,
    });
    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  static async deleteGroup(id: string, log: Logger) {
    log.debug({ id }, "Deleting group");

    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) {
      throw new GroupNotFoundError();
    }

    await prisma.group.delete({ where: { id } });
    return { success: true };
  }
}
