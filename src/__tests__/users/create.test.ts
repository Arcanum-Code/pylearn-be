import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  resetDatabase,
} from "../test_utils";

describe("POST /users", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==========================================
  // EXISTING INFRASTRUCTURE SECURITY TESTS
  // ==========================================
  it("should return 401 if not logged in", async () => {
    const payload = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password123!",
      roleId: "role-id",
    };

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("should return 403 if user has no user_management create permission", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    const role = await prisma.role.create({ data: { name: "Employee" } });

    const payload = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password123!",
      roleId: role.id,
    };

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("should return 403 if attempting to create a second SuperAdmin user", async () => {
    const superAdminRole = await prisma.role.create({
      data: { name: "SuperAdmin" },
    });

    await prisma.user.create({
      data: {
        name: "The Super Admin",
        email: "super@admin.com",
        password: "hashed_password",
        roleId: superAdminRole.id,
      },
    });

    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        body: JSON.stringify({
          name: "Wannabe SuperAdmin",
          email: "wannabe@example.com",
          password: "Password123!",
          roleId: superAdminRole.id,
        }),
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe(
      "Operation Forbidden: You cannot create user with SuperAdmin role more than one",
    );
  });

  // ==========================================
  // NEW / UPDATED USER ID IMPLEMENTATION TESTS
  // ==========================================
  it("should create user successfully with a valid custom unique userId", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    const payload = {
      name: "John Custom",
      email: "john.custom@example.com",
      password: "Password123!",
      roleId: role.id,
      userId: "mhs2026_john", // ✅ Custom alphanumeric identification key
    };

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.email).toBe("john.custom@example.com");
    expect(body.data.userId).toBe("mhs2026_john"); // ✅ Ensure field returns correctly
    expect(body.data.password).toBeUndefined();

    // Verify row was committed into physical database storage engines
    const userInDb = await prisma.user.findUnique({
      where: { userId: "mhs2026_john" },
    });
    expect(userInDb).not.toBeNull();
  });

  it("should return 400 if the provided custom userId is already taken", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    // Seed an existing collision user ahead of execution
    await prisma.user.create({
      data: {
        email: "original@example.com",
        password: "hashed_password",
        roleId: role.id,
        userId: "clash_id_123", // Taken ID
      },
    });

    const payload = {
      name: "Imposter User",
      email: "imposter@example.com",
      password: "Password123!",
      roleId: role.id,
      userId: "clash_id_123", // ✅ Triggers custom guard protection blocking duplicate entries
    };

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify(payload),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.message).toBe("This User ID is already taken.");
  });

  // ==========================================
  // ADDITIONAL VALIDATION CORNER BLOCKS
  // ==========================================
  it("should create user with isActive defaulted to true", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          name: "Jane Doe",
          email: "jane@example.com",
          password: "Password123!",
          roleId: role.id,
        }),
      }),
    );

    const user = await prisma.user.findUnique({
      where: { email: "jane@example.com" },
    });
    expect(user?.isActive).toBe(true);
  });

  it("should return 400 if email is invalid", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        body: JSON.stringify({
          name: "John",
          email: "not-an-email",
          password: "Password123!",
          roleId: role.id,
        }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("should return 409 if email already exists", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    await prisma.user.create({
      data: {
        name: "Existing",
        email: "john@example.com",
        password: "hashed",
        roleId: role.id,
      },
    });

    const res = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        body: JSON.stringify({
          name: "John",
          email: "john@example.com",
          password: "Password123!",
          roleId: role.id,
        }),
      }),
    );

    expect(res.status).toBe(409);
  });

  it("should hash password before saving", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "user_management", action: "create" },
    ]);

    const role = await prisma.role.create({ data: { name: "Employee" } });

    await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        body: JSON.stringify({
          name: "Secure User",
          email: "secure@example.com",
          password: "Password123!",
          roleId: role.id,
        }),
      }),
    );

    const user = await prisma.user.findUnique({
      where: { email: "secure@example.com" },
    });

    expect(user?.password).not.toBe("Password123!");
  });
});
