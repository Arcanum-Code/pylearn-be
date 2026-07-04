# Group Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full CRUD endpoints for the Group module with RBAC permissions (`group_management`) and OpenAPI grouping tags.

**Architecture:** We will seed the `group_management` feature in the database, define Zod schemas for partial updates and nested responses (materials and quizzes), implement the logic in `GroupService`, and expose them via Elysia endpoints protected by `checkPermission`. We will test all paths in `group.test.ts`.

**Tech Stack:** Bun, Elysia, Prisma, Zod.

---

### Task 1: Seed `group_management` feature

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update the seed script**

Modify `prisma/seed.ts` to include the `group_management` feature and assign permissions to the `SuperAdmin` and `Admin` roles. Add `"group_management"` to the `systemFeatures` array (or add it manually to the seed function).

```typescript
// Find the features array in prisma/seed.ts and ensure group_management is included.
const systemFeatures = [
  // ... existing features ...
  { name: "group_management", description: "Manage learning groups" },
];
// (Ensure the seeding logic creates this feature and grants permissions to roles).
```
*Note: Depending on how the seed is written, make sure you add it to the list of features so that it gets created.*

- [ ] **Step 2: Run the seed script to verify**

Run: `bunx prisma db seed`
Expected: SUCCESS

### Task 2: Update Group Schemas and Models

**Files:**
- Modify: `src/modules/group/schema.ts`
- Modify: `src/modules/group/model.ts`

- [ ] **Step 1: Add schemas for update and queries in `src/modules/group/schema.ts`**

```typescript
import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
```

- [ ] **Step 2: Add response schemas in `src/modules/group/model.ts`**

```typescript
import { z } from "zod";
import { createResponseSchema } from "@/libs/response";

export const GroupSafe = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Mock minimal relations for nested output
export const GroupMaterialSafe = z.object({
  id: z.string().or(z.bigint()).transform((v) => v.toString()),
  title: z.string(),
  isPublished: z.boolean(),
});

export const GroupQuizSafe = z.object({
  id: z.string().or(z.bigint()).transform((v) => v.toString()),
  title: z.string(),
  levelNumber: z.number().int(),
  isPublished: z.boolean(),
});

export const GroupDetailSafe = GroupSafe.extend({
  materials: z.array(GroupMaterialSafe),
  quizzes: z.array(GroupQuizSafe),
});

export const GroupModel = {
  createResult: createResponseSchema(GroupSafe),
  listResult: createResponseSchema(z.array(GroupSafe)),
  detailResult: createResponseSchema(GroupDetailSafe),
  updateResult: createResponseSchema(GroupSafe),
  deleteResult: createResponseSchema(z.object({ success: z.boolean() })),
};
```

### Task 3: Update Group Service

**Files:**
- Modify: `src/modules/group/service.ts`

- [ ] **Step 1: Implement methods in `GroupService`**

```typescript
import { prisma } from "@/libs/prisma";
import type { CreateGroupInput, UpdateGroupInput } from "./schema";
import type { Logger } from "pino";
import { NotFoundException } from "@/libs/exceptions";

export abstract class GroupService {
  static async createGroup(data: CreateGroupInput, log: Logger) {
    log.debug({ name: data.name }, "Creating group");
    const group = await prisma.group.create({ data });
    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  static async getGroups(log: Logger) {
    log.debug("Fetching all groups");
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: "desc" },
    });
    return groups.map((group) => ({
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }));
  }

  static async getGroupById(id: string, log: Logger) {
    log.debug({ id }, "Fetching group details");
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        materials: {
          orderBy: { sequence: "asc" },
        },
        quizzes: {
          orderBy: { levelNumber: "asc" },
        },
      },
    });

    if (!group) {
      throw new NotFoundException("Group not found", "group.notFound");
    }

    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      materials: group.materials.map(m => ({ ...m, id: m.id.toString() })),
      quizzes: group.quizzes.map(q => ({ ...q, id: q.id.toString() })),
    };
  }

  static async updateGroup(id: string, data: UpdateGroupInput, log: Logger) {
    log.debug({ id, data }, "Updating group");
    
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Group not found", "group.notFound");

    const group = await prisma.group.update({
      where: { id },
      data,
    });
    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  static async deleteGroup(id: string, log: Logger) {
    log.debug({ id }, "Deleting group");
    
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Group not found", "group.notFound");

    await prisma.group.delete({ where: { id } });
    return { success: true };
  }
}
```

### Task 4: Mount Endpoints and Apply Permissions

**Files:**
- Modify: `src/modules/group/index.ts`

- [ ] **Step 1: Update controller for CRUD, openapi tags, and permissions**

```typescript
import { GroupService } from "./service";
import { CreateGroupSchema, UpdateGroupSchema } from "./schema";
import { GroupModel } from "./model";
import { successResponse } from "@/libs/response";
import { createProtectedApp } from "@/libs/base";
import { checkPermission } from "@/libs/middlewares/auth";

export const group = createProtectedApp().group("/groups", (app) =>
  app
    .use(checkPermission("group_management", "read"))
    .get(
      "/",
      async ({ set, log, locale }) => {
        const data = await GroupService.getGroups(log);
        return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
      },
      {
        response: { 200: GroupModel.listResult },
        detail: { tags: ["Group"], summary: "List groups" },
      }
    )
    .get(
      "/:id",
      async ({ params: { id }, set, log, locale }) => {
        const data = await GroupService.getGroupById(id, log);
        return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
      },
      {
        response: { 200: GroupModel.detailResult },
        detail: { tags: ["Group"], summary: "Get group details" },
      }
    )
    .use(checkPermission("group_management", "create"))
    .post(
      "/",
      async ({ body, set, log, locale }) => {
        const data = await GroupService.createGroup(body, log);
        return successResponse(set, data, { key: "common.success" }, 201, undefined, locale);
      },
      {
        body: CreateGroupSchema,
        response: { 201: GroupModel.createResult },
        detail: { tags: ["Group"], summary: "Create group" },
      }
    )
    .use(checkPermission("group_management", "update"))
    .patch(
      "/:id",
      async ({ params: { id }, body, set, log, locale }) => {
        const data = await GroupService.updateGroup(id, body, log);
        return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
      },
      {
        body: UpdateGroupSchema,
        response: { 200: GroupModel.updateResult },
        detail: { tags: ["Group"], summary: "Update group" },
      }
    )
    .use(checkPermission("group_management", "delete"))
    .delete(
      "/:id",
      async ({ params: { id }, set, log, locale }) => {
        const data = await GroupService.deleteGroup(id, log);
        return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
      },
      {
        response: { 200: GroupModel.deleteResult },
        detail: { tags: ["Group"], summary: "Delete group" },
      }
    )
);
```

### Task 5: Update Tests

**Files:**
- Modify: `src/__tests__/integration/group.test.ts`

- [ ] **Step 1: Write integration tests covering all methods and permissions**

Overwrite `src/__tests__/integration/group.test.ts` with:

```typescript
import { describe, expect, it, beforeEach, afterAll } from "bun:test";
import { prisma } from "@/libs/prisma";
import { app } from "@/server";
import { resetDatabase, createAuthenticatedUser, randomIp } from "../test_utils";

describe("Group Module", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("CRUD /groups", () => {
    it("should manage group lifecycle with permissions", async () => {
      // Create user with ALL permissions
      const role = await createTestRoleWithPermissions("GroupAdmin", [
        { featureName: "group_management", action: "create" },
        { featureName: "group_management", action: "read" },
        { featureName: "group_management", action: "update" },
        { featureName: "group_management", action: "delete" },
      ]);
      const { authHeaders } = await createAuthenticatedUser({ roleId: role.id });

      // 1. Create
      let res = await app.handle(
        new Request("http://localhost/groups", {
          method: "POST",
          headers: { ...authHeaders, "content-type": "application/json", "x-forwarded-for": randomIp() },
          body: JSON.stringify({ name: "Week 1", description: "Intro" }),
        })
      );
      expect(res.status).toBe(201);
      let body = await res.json();
      const groupId = body.data.id;
      expect(body.data.name).toBe("Week 1");

      // 2. Read All
      res = await app.handle(
        new Request("http://localhost/groups", {
          method: "GET",
          headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        })
      );
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.data.length).toBe(1);

      // 3. Read Single
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "GET",
          headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        })
      );
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.data.name).toBe("Week 1");
      expect(body.data.materials).toBeDefined();

      // 4. Update
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "PATCH",
          headers: { ...authHeaders, "content-type": "application/json", "x-forwarded-for": randomIp() },
          body: JSON.stringify({ name: "Updated Name" }),
        })
      );
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.data.name).toBe("Updated Name");

      // 5. Delete
      res = await app.handle(
        new Request(`http://localhost/groups/${groupId}`, {
          method: "DELETE",
          headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        })
      );
      expect(res.status).toBe(200);

      // Verify deletion
      const check = await prisma.group.findUnique({ where: { id: groupId } });
      expect(check).toBeNull();
    });

    it("should reject actions if user lacks permission", async () => {
      // User with NO permissions
      const role = await createTestRoleWithPermissions("NoGroupAccess", []);
      const { authHeaders } = await createAuthenticatedUser({ roleId: role.id });

      const res = await app.handle(
        new Request("http://localhost/groups", {
          method: "GET",
          headers: { ...authHeaders, "x-forwarded-for": randomIp() },
        })
      );
      expect(res.status).toBe(403);
    });
  });
});
```
*Note: Make sure to import `createTestRoleWithPermissions` from `../test_utils`.*

- [ ] **Step 2: Run tests to verify everything passes**

Run: `bun test src/__tests__/integration/group.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat: full CRUD, RBAC, and OpenAPI tags for group module"
```
