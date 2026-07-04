import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  resetDatabase,
  randomIp,
  createTestRoleWithPermissions,
} from "../test_utils";

describe("POST /materials/me", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create a new material using authenticated user as lecturerId", async () => {
    const role = await createTestRoleWithPermissions("CreatorRoleMe", [
      { featureName: "material_management", action: "create" },
    ]);
    const { user, authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const materialData = {
      title: "Material Me",
      description: "Testing POST /materials/me",
      materialType: "text",
      content: "Some content",
      isPublished: false,
      groupId: group.id,
    };

    const response = await app.handle(
      new Request("http://localhost/materials/me", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
          "content-type": "application/json",
        },
        body: JSON.stringify(materialData),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.title).toBe("Material Me");
    expect(body.data.lecturerId).toBe(user.id);
  });

  it("should upload a material PDF successfully", async () => {
    const role = await createTestRoleWithPermissions("CreatorRoleMe", [
      { featureName: "material_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const formData = new FormData();
    formData.append("title", "Lecture Notes PDF");
    formData.append("materialType", "file");
    formData.append("isPublished", "true");
    formData.append("groupId", group.id);

    const mockPdfFile = new File(
      [new Uint8Array([1, 2, 3, 4])],
      "lecture_notes.pdf",
      {
        type: "application/pdf",
      },
    );
    formData.append("file", mockPdfFile);

    const { "content-type": _, ...headersWithoutContentType } = authHeaders;
    const res = await app.handle(
      new Request("http://localhost/materials/me", {
        method: "POST",
        headers: {
          ...headersWithoutContentType,
        },
        body: formData,
      }),
    );

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.title).toBe("Lecture Notes PDF");
    expect(json.data.content).toContain("/storage/materials/");
  });

  it("should return 400 if required fields are missing", async () => {
    const role = await createTestRoleWithPermissions("CreatorRoleMeMissing", [
      { featureName: "material_management", action: "create" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const response = await app.handle(
      new Request("http://localhost/materials/me", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          description: "Missing title and materialType",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("should return 403 if user lacks 'create' permission", async () => {
    const role = await createTestRoleWithPermissions("NoPermsRoleMe", []);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: role.id,
    });

    const group = await prisma.group.create({ data: { name: "Test Group" } });

    const response = await app.handle(
      new Request("http://localhost/materials/me", {
        method: "POST",
        headers: {
          ...authHeaders,
          "x-forwarded-for": randomIp(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Forbidden Material",
          materialType: "text",
          groupId: group.id,
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
