import { describe, expect, it, beforeEach } from "bun:test";
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
} from "../test_utils";
import { app } from "../../server";
import { prisma } from "@/libs/prisma";

describe("Lecturer Quiz API", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should create a new quiz draft", async () => {
    const role = await createTestRoleWithPermissions("LecturerRole", [
      { featureName: "lecturer_quiz_access", action: "create" },
    ]);
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "lecturer@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Test Group", description: "Test Group Desc" },
    });

    const req = new Request(
      `http://localhost/api/lecturer/groups/${group.id}/quizzes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level: 1,
          title: "Test Quiz",
          pass_threshold: 80,
        }),
      },
    );

    const res = await app.handle(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe("draft");
    expect(body.data.level).toBe(1);
  });
});
