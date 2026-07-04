import { prisma } from "@/libs/prisma";
import type { CreateGroupInput } from "./schema";
import type { Logger } from "pino";

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
}
