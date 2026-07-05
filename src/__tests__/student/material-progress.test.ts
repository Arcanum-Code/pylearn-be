import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  createTestUser,
} from "../test_utils";

describe("Student Material API - Progress", () => {
  let authHeaders: Record<string, string>;
  let groupId: string;
  let material1Id: bigint;
  let material2Id: bigint;

  beforeEach(async () => {
    await resetDatabase();

    // Seed role & permissions
    const studentRole = await createTestRoleWithPermissions("student", [
      { featureName: "student_material_access", action: "read" },
      { featureName: "student_material_access", action: "update" },
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
        materialType: "text",
        groupId,
        lecturerId: lecturer.id,
        sequence: 1,
      },
    });
    material1Id = m1.id;

    const m2 = await prisma.material.create({
      data: {
        title: "Mat 2",
        materialType: "text",
        groupId,
        lecturerId: lecturer.id,
        sequence: 2,
      },
    });
    material2Id = m2.id;
  });

  it("should update progress to completed", async () => {
    const res = await app.handle(
      new Request(
        `http://localhost/api/student/materials/${material1Id}/progress`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ status: "completed", scroll_percentage: 100 }),
        },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("completed");
    expect(body.data.scroll_percentage).toBe(100);
    expect(body.data.completed_at).not.toBeNull();
  });

  it("should update progress to in_progress with partial scroll", async () => {
    // 1. PATCH with in_progress and 50%
    const patchRes = await app.handle(
      new Request(
        `http://localhost/api/student/materials/${material2Id}/progress`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            status: "in_progress",
            scroll_percentage: 50,
          }),
        },
      ),
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.status).toBe("in_progress");
    expect(patchBody.data.scroll_percentage).toBe(50);
    expect(patchBody.data.completed_at).toBeNull();

    // 2. GET detail to verify
    const getRes = await app.handle(
      new Request(`http://localhost/api/student/materials/${material2Id}`, {
        headers: authHeaders,
      }),
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.scroll_percentage).toBe(50);
  });
});
