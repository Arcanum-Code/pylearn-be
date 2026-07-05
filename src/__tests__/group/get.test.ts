import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("Group API - Get by ID", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should get group by ID successfully with permission", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({
      data: { name: "Week 1", description: "Introduction" },
    });

    const res = await app.handle(
      new Request(`http://localhost/groups/${group.id}`, {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Week 1");
    expect(body.data.materials).toEqual([]);
    expect(body.data.quizzes).toEqual([]);
  });

  it("should return 404 if group is not found", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request(`http://localhost/groups/non-existent-id`, {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("should reject getting group if user lacks permission", async () => {
    const role = await createTestRoleWithPermissions("GroupNoReader", [
      { featureName: "group_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({
      data: { name: "Week 1" },
    });

    const res = await app.handle(
      new Request(`http://localhost/groups/${group.id}`, {
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
