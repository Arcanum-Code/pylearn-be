import { prisma } from "@/libs/prisma";
import type { CreateUserInput, UpdateUserInput } from "./schema";
import {
  CreateSystemError,
  DeleteSelfError,
  DuplicateUserFieldException,
  UpdateSystemError,
} from "./error";
import { DeleteSystemError } from "../rbac/error";
import { Prisma } from "@generated/prisma";
import type { Logger } from "pino";

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  userId: true,
  name: true,
  isActive: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// User that have this roles can't be deleted
const PROTECTED_ROLES = ["SuperAdmin"];

export abstract class UserService {
  static async getUsers(
    params: {
      page: number;
      limit: number;
      search?: string;
      isActive?: boolean;
      roleId?: string;
    },
    log: Logger,
  ) {
    log.debug(
      {
        page: params.page,
        limit: params.limit,
        search: params.search,
        isActive: params.isActive,
        roleId: params.roleId,
      },
      "Fetching users list",
    );

    const { page, limit, search, isActive, roleId } = params;

    const where: Prisma.UserWhereInput = {};

    // Filter: Role
    if (roleId) {
      where.roleId = roleId;
    }

    // Filter: isActive
    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    }

    // Filter: Search (Name OR Email OR UserId)
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { userId: { contains: search } },
      ];
    }

    // Calculate Skip
    const skip = (page - 1) * limit;

    // Execute Transaction
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          ...SAFE_USER_SELECT,
          role: {
            select: {
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    log.info({ count: users.length, total }, "Users retrieved successfully");

    // Convert Date objects to ISO strings
    const userWithStringDates = users.map((user) => ({
      ...user,
      roleName: user.role?.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));

    return {
      users: userWithStringDates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async createUser(
    data: CreateUserInput,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug(
      { email: data.email, userId: data.userId, roleId: data.roleId },
      "Creating new user",
    );

    // 🛡️ SECURITY CHECK: Duplicate SuperAdmin
    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
    });
    if (role?.name === "SuperAdmin") {
      log.warn(
        { email: data.email, roleId: data.roleId },
        "User creation blocked: Attempt to create duplicate SuperAdmin",
      );
      throw new CreateSystemError(locale);
    }

    // 🛡️ UNIQUE GUARD: Check if custom userId is already taken
    if (data.userId) {
      const existingUserId = await prisma.user.findUnique({
        where: { userId: data.userId },
      });
      if (existingUserId) {
        log.warn(
          { userId: data.userId },
          "User creation blocked: Unique userId collision",
        );
        throw new DuplicateUserFieldException("This User ID is already taken.");
      }
    }

    const hashedPassword = await Bun.password.hash(data.password);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: SAFE_USER_SELECT,
    });

    log.info(
      {
        id: user.id,
        email: user.email,
        userId: user.userId,
        roleId: user.roleId,
      },
      "User created successfully",
    );

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  static async getUser(id: string, log: Logger) {
    log.debug({ userId: id }, "Fetching user details");

    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        ...SAFE_USER_SELECT,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    log.info(
      { userId: id, email: user.email, roleName: user.role?.name },
      "User details retrieved successfully",
    );

    return {
      ...user,
      roleName: user.role?.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  static async updateUser(
    id: string,
    data: UpdateUserInput,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug({ userId: id }, "Updating user");

    const updateData = { ...data };
    if (updateData.password) {
      updateData.password = await Bun.password.hash(updateData.password);
    }

    // 🛡️ UNIQUE GUARD: Prevent updating to a userId taken by someone else
    if (updateData.userId) {
      const existingUserId = await prisma.user.findFirst({
        where: {
          userId: updateData.userId,
          NOT: { id: id }, // Exclude the current user being edited
        },
      });
      if (existingUserId) {
        log.warn(
          { id, attemptedUserId: updateData.userId },
          "User update blocked: Unique userId collision",
        );
        throw new DuplicateUserFieldException(
          "This User ID is already taken by another account.",
        );
      }
    }

    // 🛡️ SECURITY CHECK: Inactive SuperAdmin
    if (updateData.isActive === false) {
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { role: { select: { name: true } } },
      });

      if (existingUser?.role?.name === "SuperAdmin") {
        log.warn(
          { userId: id },
          "User update blocked: Attempt to deactivate SuperAdmin",
        );
        throw new UpdateSystemError(locale);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      select: SAFE_USER_SELECT,
      data: updateData,
    });

    log.info(
      { id: user.id, email: user.email, userId: user.userId },
      "User updated successfully",
    );

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  static async deleteUser(
    targetId: string,
    requestingUserId: string,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug(
      { targetUserId: targetId, requestingUserId },
      "Attempting to delete user",
    );

    // 🛡️ SECURITY CHECK: Suicide Prevention
    if (targetId === requestingUserId) {
      log.warn(
        { targetUserId: targetId },
        "User deletion blocked: Self-deletion attempt",
      );
      throw new DeleteSelfError(locale);
    }

    // Fetch user + Role to check permissions
    const targetUser = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      include: { role: true },
    });

    // 🛡️ SECURITY CHECK: Protected User
    // If the user being deleted is a SuperAdmin, BLOCK IT.
    if (targetUser.role && PROTECTED_ROLES.includes(targetUser.role.name)) {
      log.warn(
        { targetUserId: targetId, roleName: targetUser.role.name },
        "User deletion blocked: Protected SuperAdmin user",
      );
      throw new DeleteSystemError(
        "Cannot delete a user with SuperAdmin privileges.",
      );
    }

    // Safe to delete
    const user = await prisma.user.delete({
      where: { id: targetId },
      select: SAFE_USER_SELECT,
    });

    log.info(
      { userId: targetId, email: user.email },
      "User deleted successfully",
    );

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
