import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("Group API - List", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should list groups successfully with permission", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    // Create a group directly via prisma
    const group = await prisma.group.create({
      data: { name: "Week 1", description: "Introduction" },
    });

    const res = await app.handle(
      new Request("http://localhost/groups", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(group.id);
  });

  it("should reject listing groups if user lacks permission", async () => {
    const role = await createTestRoleWithPermissions("GroupNoReader", [
      { featureName: "group_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request("http://localhost/groups", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(res.status).toBe(403);
  });
});
