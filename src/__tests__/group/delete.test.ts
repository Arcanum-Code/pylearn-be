import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("Group API - Delete", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should delete a group successfully with permission", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "delete" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({
      data: { name: "To Delete" },
    });

    const res = await app.handle(
      new Request(`http://localhost/groups/${group.id}`, {
        method: "DELETE",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);

    const check = await prisma.group.findUnique({ where: { id: group.id } });
    expect(check).toBeNull();
  });

  it("should reject deleting group if user lacks permission", async () => {
    const role = await createTestRoleWithPermissions("GroupNoDeleter", [
      { featureName: "group_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({
      data: { name: "Week 1" },
    });

    const res = await app.handle(
      new Request(`http://localhost/groups/${group.id}`, {
        method: "DELETE",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(res.status).toBe(403);
  });
});
