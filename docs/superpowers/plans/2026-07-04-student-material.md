# Student Material API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Student Material API endpoints for listing group materials, viewing a material, and updating progress (with an `in_progress` state).

**Architecture:** We will update the `MaterialRead` Prisma model to support nullable `readAt` and optional `scrollPercentage` to track `in_progress` status. Then, we will create a new `student` module to house the student-facing material endpoints under `/api/student/...`, exposing it via the Elysia server, and validating it using Zod and TypeBox.

**Tech Stack:** Bun, Elysia, Prisma, Zod, TypeBox

---

### Task 1: Update Schema for Material Progress

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `MaterialRead` model**

```prisma
model MaterialRead {
  id              String    @id @default(cuid())
  materialId      BigInt
  material        Material  @relation(fields: [materialId], references: [id], onDelete: Cascade)
  studentId       String
  student         User      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  materialVersion Int
  readAt          DateTime? 
  scrollPercentage Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([studentId, materialId])
}
```

- [ ] **Step 2: Generate and Migrate**

```bash
bunx prisma generate
bunx prisma migrate dev --name update_material_read_progress
```

---

### Task 2: Models and Schemas

**Files:**
- Create: `src/modules/student/materials/model.ts`
- Create: `src/modules/student/materials/schema.ts`

- [ ] **Step 1: Write schemas**

```typescript
// src/modules/student/materials/schema.ts
import { z } from "zod";

export const GroupParamSchema = z.object({
  groupId: z.string(),
});

export const MaterialParamSchema = z.object({
  materialId: z.string(),
});

export const UpdateProgressSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
  scroll_percentage: z.number().min(0).max(100).optional(),
});
```

- [ ] **Step 2: Write models (TypeBox)**

```typescript
// src/modules/student/materials/model.ts
import { t } from "elysia";

export const StudentMaterialModel = {
  materialList: t.Object({
    group_id: t.String(),
    group_name: t.String(),
    materials: t.Array(
      t.Object({
        material_id: t.String(),
        title: t.String(),
        sequence_order: t.Number(),
        status: t.String(), // "not_started", "in_progress", "completed"
        completed_at: t.Union([t.String(), t.Null()]),
      })
    ),
    progress: t.Object({
      completed: t.Number(),
      total: t.Number(),
    }),
  }),
  materialDetail: t.Object({
    material_id: t.String(),
    group_id: t.String(),
    title: t.String(),
    content: t.Union([t.String(), t.Null()]),
    attachment_url: t.Union([t.String(), t.Null()]),
    sequence_order: t.Number(),
    status: t.String(),
    scroll_percentage: t.Union([t.Number(), t.Null()]),
    navigation: t.Object({
      prev_material_id: t.Union([t.String(), t.Null()]),
      next_material_id: t.Union([t.String(), t.Null()]),
    }),
  }),
  progressUpdate: t.Object({
    material_id: t.String(),
    status: t.String(),
    scroll_percentage: t.Union([t.Number(), t.Null()]),
    completed_at: t.Union([t.String(), t.Null()]),
  }),
  error: t.Object({
    message: t.String(),
  }),
};
```

---

### Task 3: Service Layer

**Files:**
- Create: `src/modules/student/materials/service.ts`

- [ ] **Step 1: Write the service logic**

```typescript
// src/modules/student/materials/service.ts
import { prisma } from "@/libs/prisma";
import { NotFoundError } from "@/libs/exceptions";
import type { Logger } from "pino";

export class StudentMaterialService {
  static async getGroupMaterials(groupId: string, studentId: string, log: Logger) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        materials: {
          orderBy: { sequence: 'asc' },
          include: {
            reads: {
              where: { studentId }
            }
          }
        }
      }
    });

    if (!group) throw new NotFoundError(log.bindings()?.locale || "en");

    let completedCount = 0;
    const materials = group.materials.map(mat => {
      const read = mat.reads[0];
      let status = "not_started";
      let completed_at = null;

      if (read) {
        if (read.readAt) {
          status = "completed";
          completed_at = read.readAt.toISOString();
          completedCount++;
        } else {
          status = "in_progress";
        }
      }

      return {
        material_id: mat.id.toString(),
        title: mat.title,
        sequence_order: mat.sequence,
        status,
        completed_at,
      };
    });

    return {
      group_id: group.id,
      group_name: group.name,
      materials,
      progress: {
        completed: completedCount,
        total: materials.length,
      }
    };
  }

  static async getMaterialDetail(materialId: bigint, studentId: string, log: Logger) {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        group: {
          include: {
            materials: {
              orderBy: { sequence: 'asc' },
              select: { id: true, sequence: true }
            }
          }
        },
        reads: {
          where: { studentId }
        }
      }
    });

    if (!material) throw new NotFoundError(log.bindings()?.locale || "en");

    // Auto-create progress row if it doesn't exist
    let read = material.reads[0];
    if (!read) {
      read = await prisma.materialRead.create({
        data: {
          materialId: material.id,
          studentId: studentId,
          materialVersion: material.version,
          // readAt is null by default, meaning in_progress
        }
      });
    }

    let status = "not_started";
    if (read) {
      status = read.readAt ? "completed" : "in_progress";
    }

    // Determine navigation
    const groupMaterials = material.group.materials;
    const currentIndex = groupMaterials.findIndex(m => m.id === material.id);
    const prev = currentIndex > 0 ? groupMaterials[currentIndex - 1].id.toString() : null;
    const next = currentIndex < groupMaterials.length - 1 ? groupMaterials[currentIndex + 1].id.toString() : null;

    return {
      material_id: material.id.toString(),
      group_id: material.groupId,
      title: material.title,
      content: material.content,
      attachment_url: material.sourceUrl, // Re-using sourceUrl for attachment per existing schema
      sequence_order: material.sequence,
      status,
      scroll_percentage: read ? read.scrollPercentage : null,
      navigation: {
        prev_material_id: prev,
        next_material_id: next,
      }
    };
  }

  static async updateProgress(materialId: bigint, studentId: string, payload: { status: string, scroll_percentage?: number }, log: Logger) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundError(log.bindings()?.locale || "en");

    const existingRead = await prisma.materialRead.findUnique({
      where: {
        studentId_materialId: {
          studentId,
          materialId
        }
      }
    });

    // If it's already completed, it's idempotent, do nothing but return it.
    if (existingRead && existingRead.readAt) {
      return {
        material_id: material.id.toString(),
        status: "completed",
        scroll_percentage: existingRead.scrollPercentage,
        completed_at: existingRead.readAt.toISOString(),
      };
    }

    const dataToUpdate: any = {
      materialVersion: material.version,
    };

    if (payload.status === "completed") {
      dataToUpdate.readAt = new Date();
    }
    if (payload.scroll_percentage !== undefined) {
      dataToUpdate.scrollPercentage = payload.scroll_percentage;
    }

    const updatedRead = await prisma.materialRead.upsert({
      where: {
        studentId_materialId: { studentId, materialId }
      },
      update: dataToUpdate,
      create: {
        studentId,
        materialId,
        materialVersion: material.version,
        readAt: payload.status === "completed" ? new Date() : null,
        scrollPercentage: payload.scroll_percentage ?? null
      }
    });

    return {
      material_id: material.id.toString(),
      status: updatedRead.readAt ? "completed" : "in_progress",
      scroll_percentage: updatedRead.scrollPercentage,
      completed_at: updatedRead.readAt ? updatedRead.readAt.toISOString() : null,
    };
  }
}
```

---

### Task 4: Router Setup

**Files:**
- Create: `src/modules/student/materials/index.ts`
- Create: `src/modules/student/index.ts`
- Modify: `src/modules/index.ts:1-12`
- Modify: `src/server.ts:10-90`

- [ ] **Step 1: Write materials router**

```typescript
// src/modules/student/materials/index.ts
import { createProtectedApp } from "@/libs/base";
import { successResponse, errorResponse } from "@/libs/response";
import { StudentMaterialService } from "./service";
import { StudentMaterialModel } from "./model";
import { GroupParamSchema, MaterialParamSchema, UpdateProgressSchema } from "./schema";
import { NotFoundError } from "@/libs/exceptions";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "student_material_access";

export const studentMaterials = createProtectedApp()
  .get("/groups/:groupId/materials", async ({ params, user, set, log, locale }) => {
    const data = await StudentMaterialService.getGroupMaterials(params.groupId, user.id, log);
    return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
  }, {
    params: GroupParamSchema,
    response: { 200: StudentMaterialModel.materialList, 404: StudentMaterialModel.error, 500: StudentMaterialModel.error },
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
  })
  .get("/materials/:materialId", async ({ params, user, set, log, locale }) => {
    const data = await StudentMaterialService.getMaterialDetail(BigInt(params.materialId), user.id, log);
    return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
  }, {
    params: MaterialParamSchema,
    response: { 200: StudentMaterialModel.materialDetail, 404: StudentMaterialModel.error, 500: StudentMaterialModel.error },
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
  })
  .patch("/materials/:materialId/progress", async ({ params, body, user, set, log, locale }) => {
    const data = await StudentMaterialService.updateProgress(BigInt(params.materialId), user.id, body, log);
    return successResponse(set, data, { key: "common.success" }, 200, undefined, locale);
  }, {
    params: MaterialParamSchema,
    body: UpdateProgressSchema,
    response: { 200: StudentMaterialModel.progressUpdate, 404: StudentMaterialModel.error, 500: StudentMaterialModel.error },
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
  })
  .onError(({ error, set, locale }) => {
    if (error instanceof NotFoundError) {
      return errorResponse(set, 404, { key: "common.notFound" }, null, locale);
    }
  });
```

- [ ] **Step 2: Create student module index**

```typescript
// src/modules/student/index.ts
import { createBaseApp } from "@/libs/base";
import { studentMaterials } from "./materials";

export const student = createBaseApp({ tags: ["Student"] })
  .group("/api/student", (app) => app.use(studentMaterials));
```

- [ ] **Step 3: Export from `src/modules/index.ts`**

Update `src/modules/index.ts` to export the new module. Add `export { student } from "./student";` to the list of exports.

```typescript
// src/modules/index.ts
export { health } from "./health";
export { auth } from "./auth";
export { user } from "./user";
export { rbac } from "./rbac";
export { dashboard } from "./dashboard";
export { materials } from "./materials";
export { quizzes } from "./quiz";
export { group } from "./group";
export { student } from "./student";
```

- [ ] **Step 4: Hook into `src/server.ts`**

Update `src/server.ts` to import and use `student`. Ensure it's imported from `"./modules"` and used in the main Elysia app block:

```typescript
// src/server.ts
// ... (imports)
import {
  user,
  health,
  auth,
  rbac,
  dashboard,
  materials,
  quizzes,
  group,
  student, // Add this
} from "./modules";

// ... (in Elysia app chain)
  .use(group)
  .use(student) // Add this
  .use(globalErrorHandler)
// ...
```

---

### Task 5: Write Integration Tests

**Files:**
- Create: `src/__tests__/integration/student-material.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// src/__tests__/integration/student-material.test.ts
import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "../../server";
import { prisma } from "../../libs/prisma";
import { resetDatabase } from "../utils/db";

describe("Student Material API", () => {
  let studentToken: string;
  let groupId: string;
  let material1Id: bigint;
  let material2Id: bigint;

  beforeEach(async () => {
    await resetDatabase();
    
    // Seed role & student
    const role = await prisma.role.create({ data: { name: "student" } });
    const student = await prisma.user.create({
      data: { email: "student@test.com", password: "hash", roleId: role.id }
    });
    
    // Create token
    const tokenPayload = { sub: student.id, tv: student.tokenVersion };
    const { accessJwt } = require("../../plugins/jwt");
    studentToken = await (app as any).derive(accessJwt).accessJwt.sign(tokenPayload);

    // Create group & materials
    const lecturer = await prisma.user.create({
      data: { email: "lec@test.com", password: "hash", roleId: role.id } // mock lecturer
    });
    const group = await prisma.group.create({ data: { name: "Test Group" } });
    groupId = group.id;

    const m1 = await prisma.material.create({
      data: { title: "Mat 1", materialType: "text", groupId, lecturerId: lecturer.id, sequence: 1 }
    });
    material1Id = m1.id;
    
    const m2 = await prisma.material.create({
      data: { title: "Mat 2", materialType: "text", groupId, lecturerId: lecturer.id, sequence: 2 }
    });
    material2Id = m2.id;
  });

  it("should get group materials with default progress", async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/student/groups/${groupId}/materials`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.group_name).toBe("Test Group");
    expect(body.data.materials.length).toBe(2);
    expect(body.data.materials[0].status).toBe("not_started");
  });

  it("should get material detail and auto-create in_progress state", async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/student/materials/${material1Id}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Mat 1");
    expect(body.data.status).toBe("in_progress");
    expect(body.data.navigation.next_material_id).toBe(material2Id.toString());
  });

  it("should update progress to completed", async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/student/materials/${material1Id}/progress`, {
        method: "PATCH",
        headers: { 
          Authorization: `Bearer ${studentToken}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ status: "completed", scroll_percentage: 100 })
      })
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
      new Request(`http://localhost/api/student/materials/${material2Id}/progress`, {
        method: "PATCH",
        headers: { 
          Authorization: `Bearer ${studentToken}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ status: "in_progress", scroll_percentage: 50 })
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.status).toBe("in_progress");
    expect(patchBody.data.scroll_percentage).toBe(50);
    expect(patchBody.data.completed_at).toBeNull();

    // 2. GET detail to verify
    const getRes = await app.handle(
      new Request(`http://localhost/api/student/materials/${material2Id}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.scroll_percentage).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/__tests__/integration/student-material.test.ts`
Expected: PASS

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat: implement student material API with fine-grained progress tracking"
```
