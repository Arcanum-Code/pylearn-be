import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestUser,
} from "../test_utils";

describe("Student Material API - Detail", () => {
  let authHeaders: Record<string, string>;
  let groupId: string;
  let material1Id: bigint;
  let material2Id: bigint;

  beforeEach(async () => {
    await resetDatabase();

    // Seed role & permissions
    const studentRole = await createTestRoleWithPermissions("student", [
      { featureName: "student_material_access", action: "read" },
    ]);

    // Create authenticated student
    const studentUser = await createAuthenticatedUser({
      email: "student@test.com",
      roleId: studentRole.id,
    });
    authHeaders = studentUser.authHeaders;

    // Create lecturer
    const lecturer = await createTestUser({
      email: "lec@test.com",
      id: "lecturer-user-id",
    });

    // Create group & materials
    const group = await prisma.group.create({ data: { name: "Test Group" } });
    groupId = group.id;

    const m1 = await prisma.material.create({
      data: {
        title: "Mat 1",
        materialType: "file",
        content: "/storage/1.pdf",
        groupId,
        lecturerId: lecturer.id,
        sequence: 1,
        publishedAt: new Date(Date.now() - 100000),
      },
    });
    material1Id = m1.id;

    const m2 = await prisma.material.create({
      data: {
        title: "Mat 2",
        materialType: "file",
        content: "/storage/2.pdf",
        groupId,
        lecturerId: lecturer.id,
        sequence: 2,
        publishedAt: new Date(Date.now() - 100000),
      },
    });
    material2Id = m2.id;
  });

  it("should get material detail and auto-create in_progress state", async () => {
    const res = await app.handle(
      new Request(`http://localhost/student/materials/${material1Id}`, {
        headers: authHeaders,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Mat 1");
    expect(body.data.status).toBe("in_progress");
    expect(body.data.navigation.next_material_id).toBe(material2Id.toString());
  });
});
