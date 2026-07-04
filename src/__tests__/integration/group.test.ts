import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { GroupService } from "@/modules/group/service";
import pino from "pino";
import { prisma } from "@/libs/prisma";
import { app } from "@/server";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
} from "../test_utils";

const log = pino({ level: "silent" });

describe("Group Module Integration Tests", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GroupService", () => {
    it("should create a group", async () => {
      const group = await GroupService.createGroup(
        { name: "Week 1", description: "Intro" },
        log,
      );
      expect(group.name).toBe("Week 1");
      expect(group.description).toBe("Intro");
      expect(group.id).toBeDefined();
    });

    it("should get all groups", async () => {
      await GroupService.createGroup({ name: "Group A" }, log);
      await GroupService.createGroup({ name: "Group B" }, log);

      const groups = await GroupService.getGroups(log);
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe("Group B"); // Ordered desc by createdAt
    });

    it("should get group by ID with nested materials and quizzes", async () => {
      const group = await GroupService.createGroup({ name: "Week 1" }, log);

      const role = await createTestRoleWithPermissions("LecturerRole", []);
      const auth = await createAuthenticatedUser({ roleId: role.id });

      const material = await prisma.material.create({
        data: {
          groupId: group.id,
          lecturerId: auth.user.id,
          title: "Lecture Material",
          materialType: "pdf",
          version: 1,
        },
      });

      const quiz = await prisma.quiz.create({
        data: {
          groupId: group.id,
          title: "Quiz 1",
          levelNumber: 1,
        },
      });

      const groupDetails = await GroupService.getGroupById(group.id, log);
      expect(groupDetails.name).toBe("Week 1");
      expect(groupDetails.materials).toHaveLength(1);
      expect(groupDetails.materials[0].title).toBe("Lecture Material");
      expect(groupDetails.materials[0].id).toBe(material.id.toString());
      expect(groupDetails.quizzes).toHaveLength(1);
      expect(groupDetails.quizzes[0].title).toBe("Quiz 1");
      expect(groupDetails.quizzes[0].id).toBe(quiz.id.toString());
    });

    it("should update group details", async () => {
      const group = await GroupService.createGroup(
        { name: "Old Name", description: "Old Desc" },
        log,
      );
      const updated = await GroupService.updateGroup(
        group.id,
        { name: "New Name", description: null },
        log,
      );
      expect(updated.name).toBe("New Name");
      expect(updated.description).toBeNull();
    });

    it("should delete group", async () => {
      const group = await GroupService.createGroup({ name: "To Delete" }, log);
      const result = await GroupService.deleteGroup(group.id, log);
      expect(result.success).toBe(true);

      const check = await prisma.group.findUnique({ where: { id: group.id } });
      expect(check).toBeNull();
    });
  });

  describe("API Endpoints", () => {
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

    it("should lifecycle manage group with permissions", async () => {
      const role = await createTestRoleWithPermissions("GroupAdmin", [
        { featureName: "group_management", action: "create" },
        { featureName: "group_management", action: "read" },
        { featureName: "group_management", action: "update" },
        { featureName: "group_management", action: "delete" },
      ]);
      const { authHeaders } = await createAuthenticatedUser({
        roleId: role.id,
      });

      // 1. POST /groups (Create)
      let res = await app.handle(
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
          }),
        }),
      );
      expect(res.status).toBe(201);
      let body = await res.json();
      const groupId = body.data.id;
      expect(body.data.name).toBe("Week 1");

      // 2. GET /groups (List)
      res = await app.handle(
        new Request("http://localhost/groups", {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(groupId);

      // 3. GET /groups/:id (Detail)
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.data.name).toBe("Week 1");
      expect(body.data.materials).toEqual([]);
      expect(body.data.quizzes).toEqual([]);

      // 4. PATCH /groups/:id (Update)
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
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
      body = await res.json();
      expect(body.data.name).toBe("Updated Week 1");

      // 5. DELETE /groups/:id (Delete)
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "DELETE",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.data.success).toBe(true);

      // Confirm is deleted
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "GET",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(res.status).toBe(404);
    });

    it("should reject lifecycle API actions if user lacks permission", async () => {
      const readRole = await createTestRoleWithPermissions("GroupReader", [
        { featureName: "group_management", action: "read" },
      ]);
      const writeRole = await createTestRoleWithPermissions("GroupWriter", [
        { featureName: "group_management", action: "create" },
      ]);

      const reader = await createAuthenticatedUser({ roleId: readRole.id });
      const writer = await createAuthenticatedUser({
        id: "writer-id",
        email: "writer@test.com",
        roleId: writeRole.id,
      });

      // Reader tries to create -> 403
      let res = await app.handle(
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

      // Create group first using writer
      res = await app.handle(
        new Request("http://localhost/groups", {
          method: "POST",
          headers: {
            ...writer.authHeaders,
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({ name: "Writer Group" }),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      const groupId = body.data.id;

      // Reader tries to delete -> 403
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "DELETE",
          headers: {
            ...reader.authHeaders,
            "x-forwarded-for": randomIp(),
          },
        }),
      );
      expect(res.status).toBe(403);
    });
  });
});
