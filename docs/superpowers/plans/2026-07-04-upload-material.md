# Upload Material (US-L1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow lecturers to upload and edit materials within specific groups, enforcing spaced sequence ordering and version-based read preservation.

**Architecture:** We will introduce a `Group` model and a `MaterialRead` model. `Material` will belong to `Group`. To handle sequencing, materials will use spaced integers (e.g., 1000, 2000). To handle "force re-read", `Material` will have a `version` (starts at 1) and `MaterialRead` will track the `materialVersion` read by the student.

**Tech Stack:** Bun, Elysia, Prisma, PostgreSQL, Zod

---

### Task 1: Update Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Modify the schema**

```prisma
// Apply these changes to prisma/schema.prisma
// 1. In Material model, add version, group relation, and reads
  groupId      String
  group        Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)
  sequence     Int       @default(0)
  version      Int       @default(1)
  reads        MaterialRead[]

// 2. Add Group model before Quiz model
model Group {
  id          String     @id @default(cuid())
  name        String
  description String?
  materials   Material[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

// 3. Add MaterialRead model before Quiz model
model MaterialRead {
  id              String    @id @default(cuid())
  materialId      BigInt
  material        Material  @relation(fields: [materialId], references: [id], onDelete: Cascade)
  studentId       String
  student         User      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  materialVersion Int
  readAt          DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([studentId, materialId])
}

// 4. In User model, add relations
  MaterialRead  MaterialRead[]
```

- [ ] **Step 2: Generate and apply migration**

Run: `bunx prisma migrate dev --name add_group_and_material_versioning`
Expected: Migration succeeds and Prisma client is generated.

### Task 2: Create Group Module

**Files:**
- Create: `src/modules/group/schema.ts`
- Create: `src/modules/group/model.ts`
- Create: `src/modules/group/service.ts`
- Create: `src/modules/group/index.ts`
- Create: `src/__tests__/integration/group.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/integration/group.test.ts
import { describe, expect, it, beforeEach } from 'bun:test';
import { GroupService } from '../../modules/group/service';
import pino from 'pino';
import { prisma } from '../../libs/prisma';

const log = pino({ level: 'silent' });

describe('GroupService', () => {
  beforeEach(async () => {
    await prisma.group.deleteMany();
  });

  it('should create a group', async () => {
    const group = await GroupService.createGroup({ name: 'Week 1', description: 'Intro' }, log);
    expect(group.name).toBe('Week 1');
    expect(group.id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/integration/group.test.ts`
Expected: FAIL (GroupService not found)

- [ ] **Step 3: Implement schemas and models**

```typescript
// src/modules/group/schema.ts
import { z } from 'zod';

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
```

```typescript
// src/modules/group/model.ts
import { z } from 'zod';
import { createResponseSchema } from '@/libs/response';

export const GroupSafe = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GroupModel = {
  createResult: createResponseSchema(GroupSafe),
};
```

- [ ] **Step 4: Implement GroupService**

```typescript
// src/modules/group/service.ts
import { prisma } from '@/libs/prisma';
import type { CreateGroupInput } from './schema';
import type { Logger } from 'pino';

export abstract class GroupService {
  static async createGroup(data: CreateGroupInput, log: Logger) {
    log.debug({ name: data.name }, 'Creating group');
    const group = await prisma.group.create({ data });
    return {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 5: Implement Group Controller**

```typescript
// src/modules/group/index.ts
import { GroupService } from './service';
import { CreateGroupSchema } from './schema';
import { GroupModel } from './model';
import { successResponse } from '@/libs/response';
import { createProtectedApp } from '@/libs/base';

export const group = createProtectedApp().group('/groups', (app) =>
  app.post(
    '/',
    async ({ body, set, log, locale }) => {
      const data = await GroupService.createGroup(body, log);
      return successResponse(set, data, { key: 'common.success' }, 201, undefined, locale);
    },
    {
      body: CreateGroupSchema,
      response: {
        201: GroupModel.createResult,
      },
    }
  )
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/__tests__/integration/group.test.ts`
Expected: PASS

### Task 3: Update Material Upload API

**Files:**
- Modify: `src/modules/materials/schema.ts`
- Modify: `src/modules/materials/service.ts`
- Modify: `src/__tests__/integration/materials.test.ts`

- [ ] **Step 1: Write failing tests for Material upload and edit**

```typescript
// src/__tests__/integration/materials.test.ts
// Add this to existing test file or create it if missing
import { describe, expect, it, beforeEach } from 'bun:test';
import { MaterialService } from '../../modules/materials/service';
import pino from 'pino';
import { prisma } from '../../libs/prisma';

const log = pino({ level: 'silent' });

describe('MaterialService - Upload & Sequence', () => {
  let lecturerId: string;
  let groupId: string;

  beforeEach(async () => {
    await prisma.material.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();
    
    // Setup lecturer and group
    const role = await prisma.role.create({ data: { name: 'Lecturer' } });
    const user = await prisma.user.create({
      data: { email: 'lec@test.com', password: 'hash', roleId: role.id }
    });
    lecturerId = user.id;
    
    const group = await prisma.group.create({ data: { name: 'G1' } });
    groupId = group.id;
  });

  it('should assign a default sequence of 1000 for the first material in a group', async () => {
    const mat = await MaterialService.createMaterial({
      lecturerId,
      groupId,
      title: 'M1',
      materialType: 'pdf'
    }, log);
    expect(mat.sequence).toBe(1000);
    expect(mat.version).toBe(1);
  });

  it('should increment version when forceReread is true', async () => {
    const mat = await MaterialService.createMaterial({
      lecturerId, groupId, title: 'M1', materialType: 'pdf'
    }, log);
    
    const updated = await MaterialService.updateMaterial(mat.id, {
      title: 'M1 updated',
      forceReread: true
    }, log);
    
    expect(updated.version).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/__tests__/integration/materials.test.ts`
Expected: FAIL due to missing fields/schemas in `MaterialService`.

- [ ] **Step 3: Update Material Schemas**

```typescript
// src/modules/materials/schema.ts
import { z } from 'zod';

export const CreateMaterialSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  materialType: z.string(),
  content: z.string().optional(),
  sourceUrl: z.string().optional(),
  iconName: z.string().optional(),
  isPublished: z.boolean().optional(),
  groupId: z.string(),
  sequence: z.number().int().optional(), // Lecturer can set order
});

export const UpdateMaterialSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  materialType: z.string().optional(),
  content: z.string().optional(),
  sourceUrl: z.string().optional(),
  iconName: z.string().optional(),
  isPublished: z.boolean().optional(),
  sequence: z.number().int().optional(),
  forceReread: z.boolean().optional(), // Triggers version bump
});
```

- [ ] **Step 4: Update Material Service Implementation**

```typescript
// Add these changes to src/modules/materials/service.ts
import { prisma } from '@/libs/prisma';
import type { Logger } from 'pino';
import { z } from 'zod';
import { CreateMaterialSchema, UpdateMaterialSchema } from './schema';

export abstract class MaterialService {
  static async createMaterial(data: z.infer<typeof CreateMaterialSchema> & { lecturerId: string }, log: Logger) {
    let sequence = data.sequence;
    if (!sequence) {
      // Find max sequence in this group
      const lastMat = await prisma.material.findFirst({
        where: { groupId: data.groupId },
        orderBy: { sequence: 'desc' },
      });
      sequence = lastMat ? lastMat.sequence + 1000 : 1000;
    }

    const material = await prisma.material.create({
      data: {
        ...data,
        sequence,
        version: 1,
      }
    });
    return material;
  }

  static async updateMaterial(id: bigint, data: z.infer<typeof UpdateMaterialSchema>, log: Logger) {
    const { forceReread, ...updateData } = data;
    
    // We fetch current version if forceReread is true
    let incrementVersion = 0;
    if (forceReread) {
       incrementVersion = 1;
    }

    const material = await prisma.material.update({
      where: { id },
      data: {
        ...updateData,
        version: {
          increment: incrementVersion
        }
      }
    });
    return material;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/__tests__/integration/materials.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat: implement material group assignment, sequence spacing, and read versioning"
```
