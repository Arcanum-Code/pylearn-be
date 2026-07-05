import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("Group API - Update", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should update a group successfully with permission", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "update" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({
      data: { name: "Old Name", description: "Old Desc" },
    });

    const res = await app.handle(
      new Request(`http://localhost/groups/${group.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "Updated Week 1",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Updated Week 1");
  });

  it("should reject updating group if user lacks permission", async () => {
    const role = await createTestRoleWithPermissions("GroupNoWriter", [
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
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "Updated Week 1",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
