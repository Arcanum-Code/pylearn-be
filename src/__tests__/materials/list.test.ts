import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  resetDatabase,
  randomIp,
  createTestRoleWithPermissions,
  createTestMaterial,
  createTestUser,
} from "../test_utils";

describe("GET /materials", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should return empty list when no materials exist", async () => {
    const role = await createTestRoleWithPermissions("ReaderRole", [
      { featureName: "material_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("should return list of materials with pagination", async () => {
    const role = await createTestRoleWithPermissions("ReaderRole", [
      { featureName: "material_management", action: "read" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    await createTestMaterial(user.id, {
      title: "Material 1",
      materialType: "file",
      content: "/storage/test.pdf",
      publishedAt: new Date().toISOString(),
    });
    await createTestMaterial(user.id, {
      title: "Material 2",
      materialType: "video",
      publishedAt: new Date().toISOString(),
    });
    await createTestMaterial(user.id, {
      title: "Material 3",
      materialType: "link",
    });

    const response = await app.handle(
      new Request("http://localhost/materials?page=1&limit=2", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
  });

  it("should filter by lecturerId", async () => {
    const role = await createTestRoleWithPermissions("ReaderRole", [
      { featureName: "material_management", action: "read" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const otherUser = await createTestUser({
      id: "other-user-id",
      email: "other@test.com",
    });

    await createTestMaterial(user.id, {
      title: "Material by user 1",
      materialType: "file",
      content: "/storage/test.pdf",
    });
    await createTestMaterial(otherUser.id, {
      title: "Material by other user",
      materialType: "file",
      content: "/storage/test.pdf",
    });

    const response = await app.handle(
      new Request(`http://localhost/materials?lecturerId=${user.id}`, {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].lecturerId).toBe(user.id);
  });

  it("should filter by materialType", async () => {
    const role = await createTestRoleWithPermissions("ReaderRole", [
      { featureName: "material_management", action: "read" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    await createTestMaterial(user.id, {
      title: "Text Material",
      materialType: "file",
      content: "/storage/test.pdf",
    });
    await createTestMaterial(user.id, {
      title: "Video Material",
      materialType: "video",
    });

    const response = await app.handle(
      new Request("http://localhost/materials?materialType=video", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].materialType).toBe("video");
  });

  it("should filter by isPublished", async () => {
    const role = await createTestRoleWithPermissions(
      "ReaderRoleForIsPublished",
      [{ featureName: "material_management", action: "read" }],
    );
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    await createTestMaterial(user.id, {
      title: "Published Material",
      materialType: "file",
      content: "/storage/test.pdf",
      publishedAt: new Date().toISOString(),
    });
    await createTestMaterial(user.id, {
      title: "Draft Material",
      materialType: "file",
      content: "/storage/test.pdf",
    });

    const response = await app.handle(
      new Request("http://localhost/materials?publishedAt=foo", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].publishedAt).not.toBeNull();
  });

  it("should return 401 without authentication", async () => {
    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "GET",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("should return 403 if user lacks 'read' permission", async () => {
    const role = await createTestRoleWithPermissions("NoPermsRole", []);
    const { authHeaders } = await createAuthenticatedUser({ roleId: role.id });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("should list materials if user has 'read' permission", async () => {
    const role = await createTestRoleWithPermissions("ReaderRole", [
      { featureName: "material_management", action: "read" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    await createTestMaterial(user.id, { title: "Readable Material" });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "GET",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].title).toBe("Readable Material");
  });
});
