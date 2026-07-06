import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

describe("Group API - Create", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create a group successfully with permission", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request("http://localhost/groups", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "Week 1",
          description: "Introduction",
          level: "ADVANCED",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Week 1");
    expect(body.data.description).toBe("Introduction");
    expect(body.data.level).toBe("ADVANCED");
  });

  it("should create a group with default level BASIC if not specified", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request("http://localhost/groups", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "Default Level Group",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.level).toBe("BASIC");
  });

  it("should fail validation if name is empty on creation", async () => {
    const role = await createTestRoleWithPermissions("GroupAdmin", [
      { featureName: "group_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const res = await app.handle(
      new Request("http://localhost/groups", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "",
        }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("should reject creation if user lacks permission", async () => {
    const readRole = await createTestRoleWithPermissions("GroupReader", [
      { featureName: "group_management", action: "read" },
    ]);
    const reader = await createAuthenticatedUser({ roleId: readRole.id });

    const res = await app.handle(
      new Request("http://localhost/groups", {
        method: "POST",
        headers: {
          ...reader.authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ name: "Forbidden Group" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
