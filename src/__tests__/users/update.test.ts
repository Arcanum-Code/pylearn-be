import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  resetDatabase,
} from "../test_utils";

describe("PATCH /users/:id", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==========================================
  // EXISTING INFRASTRUCTURE SECURITY BLOCKS
  // ==========================================
  it("should return 401 if not logged in", async () => {
    const res = await app.handle(
      new Request("http://localhost/users/some-id", {
        method: "PATCH",
        headers: {
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ name: "Updated Name" }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("should return 403 if user has no user_management update permission", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    const targetUser = await prisma.user.findFirst();

    const res = await app.handle(
      new Request(`http://localhost/users/${targetUser!.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ name: "Updated" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("should return 403 if attempting to deactivate a SuperAdmin user", async () => {
    const superAdminRole = await prisma.role.create({
      data: { name: "SuperAdmin" },
    });

    const targetUser = await prisma.user.create({
      data: {
        name: "The Boss",
        email: "boss@admin.com",
        password: "hashed_password",
        roleId: superAdminRole.id,
        isActive: true,
      },
    });

    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const res = await app.handle(
      new Request(`http://localhost/users/${targetUser.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ isActive: false }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.message).toMatch(/forbidden|superadmin/i);
  });

  // ==========================================
  // NEW / UPDATED USER ID IMPLEMENTATION TESTS
  // ==========================================
  it("should update userId successfully", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const targetUser = await prisma.user.findFirst();

    const res = await app.handle(
      new Request(`http://localhost/users/${targetUser!.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ userId: "unique_userid_2026" }), // ✅ Modifying custom profile ID field
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.userId).toBe("unique_userid_2026");

    // Double-check physical database tracking state
    const verifiedDbRow = await prisma.user.findUnique({
      where: { id: targetUser!.id },
    });
    expect(verifiedDbRow?.userId).toBe("unique_userid_2026");
  });

  it("should return 400 if updating userId to one that is already taken by another user", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    // Seed a distinct account that pre-claims our target identifier
    await prisma.user.create({
      data: {
        email: "owner@example.com",
        password: "hashed_password",
        roleId: role.id,
        userId: "taken_id_999",
      },
    });

    const targetUser = await prisma.user.findFirst({
      where: {
        email: { not: "owner@example.com" }, // Pick the other test user
      },
    });

    const res = await app.handle(
      new Request(`http://localhost/users/${targetUser!.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ userId: "taken_id_999" }), // ✅ Conflict collision injection attempt
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe(
      "This User ID is already taken by another account.",
    );
  });

  // ==========================================
  // CORE FIELD PATCH COMPLIANCE TESTS
  // ==========================================
  it("should update user name successfully", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const targetUser = await prisma.user.findFirst();

    const res = await app.handle(
      new Request(`http://localhost/users/${targetUser!.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ name: "Updated Name" }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Updated Name");
  });

  it("should update password and hash it", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const targetUser = await prisma.user.findFirst();

    await app.handle(
      new Request(`http://localhost/users/${targetUser!.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ password: "NewPassword123!" }),
      }),
    );

    const updated = await prisma.user.findUnique({
      where: { id: targetUser!.id },
    });

    expect(updated?.password).not.toBe("NewPassword123!");
  });

  it("should return 400 if request body is empty", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const res = await app.handle(
      new Request(`http://localhost/users/${user.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("should not leak password in response", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "update" },
    ]);

    const targetUser = await prisma.user.findFirst();

    const res = await app.handle(
      new Request(`http://localhost/users/${targetUser!.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ name: "Updated" }),
      }),
    );

    const body = await res.json();
    expect(body.data.password).toBeUndefined();
  });
});
