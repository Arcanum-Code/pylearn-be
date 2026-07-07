import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  resetDatabase,
  randomIp,
  createTestRoleWithPermissions,
  createTestMaterial,
} from "../test_utils";

describe("PATCH /materials/:id", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should update a material", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRoleForMaterial", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id, {
      title: "Original Title",
    });

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          title: "Updated Title",
          description: "Updated description",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.title).toBe("Updated Title");
    expect(body.data.description).toBe("Updated description");
  });

  it("should update materialType", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRole", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id, {
      title: "Test Material",
    });

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          materialType: "video",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.materialType).toBe("video");
  });

  it("should set publishedAt when isPublished is set to true", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRole", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id, {
      title: "Test Material",
    });

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          publishedAt: new Date().toISOString(),
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.publishedAt).not.toBeNull();
    expect(body.data.publishedAt).not.toBeNull();
  });

  it("should clear publishedAt when isPublished is set to false", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRole", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id, {
      title: "Test Material",
      publishedAt: new Date().toISOString(),
      publishedAt: new Date(),
    });

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.publishedAt).toBeNull();
    expect(body.data.publishedAt).toBeNull();
  });

  it("should return 400 for invalid materialType", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRole", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id, {
      title: "Test Material",
    });

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          materialType: "invalid",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("should return 404 for non-existent material", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRole", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const response = await app.handle(
      new Request("http://localhost/materials/999999999", {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("should return 401 without authentication", async () => {
    const { user } = await createAuthenticatedUser();

    const material = await createTestMaterial(user.id, {
      title: "Test Material",
    });

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("should return 403 if user lacks 'update' permission", async () => {
    const role = await createTestRoleWithPermissions("NoPermsRole", []);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id);

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          title: "Unauthorized Update",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("should update material if user has 'update' permission", async () => {
    const role = await createTestRoleWithPermissions("UpdaterRole", [
      { featureName: "material_management", action: "update" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const material = await createTestMaterial(user.id);

    const response = await app.handle(
      new Request(`http://localhost/materials/${material.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          title: "Authorized Update",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.title).toBe("Authorized Update");
  });
});
