import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { GroupService } from "@/modules/group/service";
import pino from "pino";
import { prisma } from "@/libs/prisma";
import { app } from "@/server";
import {
  resetDatabase,
  createAuthenticatedUser,
  randomIp,
} from "../test_utils";

const log = pino({ level: "silent" });

describe("Group Module", () => {
  beforeEach(async () => {
    // Delete groups using resetDatabase helper
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
  });

  describe("POST /groups", () => {
    it("should fail if unauthenticated", async () => {
      const res = await app.handle(
        new Request("http://localhost/groups", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            name: "Week 1",
            description: "Intro",
          }),
        }),
      );

      expect(res.status).toBe(401);
    });

    it("should create a group if authenticated", async () => {
      const { authHeaders } = await createAuthenticatedUser();

      const res = await app.handle(
        new Request("http://localhost/groups", {
          method: "POST",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            name: "Week 1",
            description: "Intro",
          }),
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.error).toBe(false);
      expect(body.data.name).toBe("Week 1");
      expect(body.data.description).toBe("Intro");
      expect(body.data.id).toBeDefined();
    });

    it("should fail validation if name is empty", async () => {
      const { authHeaders } = await createAuthenticatedUser();

      const res = await app.handle(
        new Request("http://localhost/groups", {
          method: "POST",
          headers: {
            ...authHeaders,
            "x-forwarded-for": randomIp(),
          },
          body: JSON.stringify({
            name: "",
            description: "Intro",
          }),
        }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe(true);
    });
  });
});
