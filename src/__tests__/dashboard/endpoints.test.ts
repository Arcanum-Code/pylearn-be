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

  describe("GET /lecturer/groups/:groupId/dashboard/summary", () => {
    it("should return 401 if not logged in", async () => {
      const res = await app.handle(
        new Request(
          "http://localhost/lecturer/groups/some-group/dashboard/summary",
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
          "http://localhost/lecturer/groups/some-group/dashboard/summary",
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
          `http://localhost/lecturer/groups/${group.id}/dashboard/summary`,
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

  describe("GET /lecturer/groups/:groupId/dashboard/content-health", () => {
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
          `http://localhost/lecturer/groups/${group.id}/dashboard/content-health`,
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

  describe("GET /lecturer/calendar/events", () => {
    it("should return 401 if not logged in", async () => {
      const res = await app.handle(
        new Request(
          "http://localhost/lecturer/calendar/events?year=2026&month=7",
          {
            headers: { "x-forwarded-for": randomIp() },
          },
        ),
      );
      expect(res.status).toBe(401);
    });

    it("should return 200 with calendar events if authorized", async () => {
      const role = await createTestRoleWithPermissions("Dosen", [
        { featureName: "group_management", action: "read" },
      ]);
      const { authHeaders, user } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const group = await prisma.group.create({
        data: { name: "Test Group" },
      });

      // Create a material scheduled for release in July 2026
      await prisma.material.create({
        data: {
          title: "Intro to Python",
          materialType: "TEXT",
          groupId: group.id,
          lecturerId: user.id,
          publishedAt: new Date("2026-07-15T08:00:00Z"),
        },
      });

      // Create a quiz scheduled to open and close in July 2026
      await prisma.quiz.create({
        data: {
          title: "Control Flow Quiz",
          groupId: group.id,
          levelNumber: 1,
          startTime: new Date("2026-07-20T09:00:00Z"),
          endTime: new Date("2026-07-22T17:00:00Z"),
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/lecturer/calendar/events?year=2026&month=7&groupId=${group.id}`,
          {
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.error).toBe(false);
      expect(json.data).toHaveLength(3);

      expect(json.data[0].type).toBe("material_release");
      expect(json.data[0].date).toBe("2026-07-15");
      expect(json.data[0].time).toBe("08:00");

      expect(json.data[1].type).toBe("quiz_open");
      expect(json.data[1].date).toBe("2026-07-20");

      expect(json.data[2].type).toBe("quiz_close");
      expect(json.data[2].date).toBe("2026-07-22");
    });
  });

  describe("GET /lecturer/dashboard/recent-activity", () => {
    it("should return 401 if not logged in", async () => {
      const res = await app.handle(
        new Request("http://localhost/lecturer/dashboard/recent-activity", {
          headers: { "x-forwarded-for": randomIp() },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("should return 200 with recent student quiz submissions", async () => {
      const role = await createTestRoleWithPermissions("Dosen", [
        { featureName: "group_management", action: "read" },
      ]);
      const { authHeaders, user } = await createAuthenticatedUser({
        roleId: role.id,
      });

      const group = await prisma.group.create({
        data: { name: "Test Group" },
      });

      const student = await prisma.user.create({
        data: {
          email: "student@example.com",
          password: "password123",
          name: "John Doe",
          roleId: role.id,
        },
      });

      const quiz = await prisma.quiz.create({
        data: {
          title: "Python Variables Quiz",
          groupId: group.id,
          levelNumber: 1,
        },
      });

      // Create a quiz attempt (unsubmitted)
      await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: student.id,
          attemptNumber: 1,
          startedAt: new Date(),
        },
      });

      // Create a submitted quiz attempt
      await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          studentId: student.id,
          attemptNumber: 2,
          startedAt: new Date("2026-07-06T10:00:00Z"),
          submittedAt: new Date("2026-07-06T10:30:00Z"),
          score: 85,
        },
      });

      const res = await app.handle(
        new Request(
          `http://localhost/lecturer/dashboard/recent-activity?limit=5`,
          {
            headers: {
              ...authHeaders,
              "x-forwarded-for": randomIp(),
            },
          },
        ),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.error).toBe(false);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].studentName).toBe("John Doe");
      expect(json.data[0].taskName).toBe("Python Variables Quiz");
      expect(json.data[0].score).toBe(85);
      expect(json.data[0].groupId).toBe(group.id);
    });
  });
});
