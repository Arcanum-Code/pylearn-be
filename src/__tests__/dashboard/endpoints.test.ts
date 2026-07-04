import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  resetDatabase,
} from "../test_utils";

describe("Lecturer Dashboard Endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GET /api/lecturer/groups/:groupId/dashboard/summary", () => {
    it("should return 401 if not logged in", async () => {
      const res = await app.handle(
        new Request(
          "http://localhost/api/lecturer/groups/some-group/dashboard/summary",
          {
            headers: { "x-forwarded-for": randomIp() },
          },
        ),
      );
      expect(res.status).toBe(401);
    });

    it("should return 403 if logged in but has no group_read permission", async () => {
      const role = await createTestRoleWithPermissions("Mahasiswa", []);
      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const res = await app.handle(
        new Request(
          "http://localhost/api/lecturer/groups/some-group/dashboard/summary",
          {
            headers: authHeaders,
          },
        ),
      );
      expect(res.status).toBe(403);
    });

    it("should return 200 with summary data if authorized", async () => {
      const role = await createTestRoleWithPermissions("Dosen", [
        { featureName: "group_management", action: "read" },
      ]);
      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const group = await prisma.group.create({
        data: { name: "Test Group", description: "Integration test group" },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/api/lecturer/groups/${group.id}/dashboard/summary`,
          {
            headers: authHeaders,
          },
        ),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.group_id).toBe(group.id);
      expect(json.data.total_students).toBe(0);
      expect(json.data.total_materials).toBe(0);
    });
  });

  describe("GET /api/lecturer/groups/:groupId/dashboard/content-health", () => {
    it("should return 200 with content health data if authorized", async () => {
      const role = await createTestRoleWithPermissions("Dosen", [
        { featureName: "group_management", action: "read" },
      ]);
      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const group = await prisma.group.create({
        data: { name: "Test Group" },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/api/lecturer/groups/${group.id}/dashboard/content-health`,
          {
            headers: authHeaders,
          },
        ),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.quizzes).toBeArray();
      expect(json.data.materials).toBeArray();
    });
  });
});
