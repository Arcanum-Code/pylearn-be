import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  resetDatabase,
  randomIp,
  createTestRoleWithPermissions,
  defaultMaterialData,
} from "../test_utils";

describe("POST /materials", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create a new material", async () => {
    const role = await createTestRoleWithPermissions(
      "CreatorRoleForAllFields",
      [{ featureName: "material_management", action: "create" }],
    );
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          ...defaultMaterialData(user.id),
          groupId: group.id,
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.title).toBe("Test Material");
    expect(body.data.materialType).toBe("text");
    expect(body.data.lecturerId).toBe(user.id);
  });

  it("should create a material with all fields", async () => {
    const role = await createTestRoleWithPermissions(
      "CreatorRoleForAllFields",
      [{ featureName: "material_management", action: "create" }],
    );
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          ...defaultMaterialData(user.id),
          groupId: group.id,
          title: "Video Material",
          description: "A video tutorial",
          materialType: "video",
          sourceUrl: "https://example.com/video.mp4",
          iconName: "video-icon",
          publishedAt: new Date().toISOString(),
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.title).toBe("Video Material");
    expect(body.data.materialType).toBe("video");
    expect(body.data.sourceUrl).toBe("https://example.com/video.mp4");
    expect(body.data.publishedAt).not.toBeNull();
    expect(body.data.publishedAt).not.toBeNull();
  });

  it("should return 400 for invalid materialType", async () => {
    const { user, authHeaders } = await createAuthenticatedUser();

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          ...defaultMaterialData(user.id),
          groupId: group.id,
          title: "Invalid Type",
          materialType: "invalid",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("should return 400 for missing required fields", async () => {
    const { authHeaders } = await createAuthenticatedUser();

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          description: "Missing required fields",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("should return 401 without authentication", async () => {
    const group = await prisma.group.create({ data: { name: "Test Group" } });
    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          lecturerId: "test-user-id",
          groupId: group.id,
          title: "Test Material",
          materialType: "file",
          content: "/storage/test.pdf",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("should return 403 if user lacks 'create' permission", async () => {
    const role = await createTestRoleWithPermissions("NoPermsRole", []);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          ...defaultMaterialData(user.id),
          groupId: group.id,
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("should create material if user has 'create' permission", async () => {
    const role = await createTestRoleWithPermissions("CreatorRole", [
      { featureName: "material_management", action: "create" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const response = await app.handle(
      new Request("http://localhost/materials", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          ...defaultMaterialData(user.id),
          groupId: group.id,
        }),
      }),
    );
    expect(response.status).toBe(201);
  });
});
