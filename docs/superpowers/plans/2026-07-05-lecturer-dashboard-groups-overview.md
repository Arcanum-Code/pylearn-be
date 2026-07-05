# Lecturer Dashboard Groups Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the general lecturer dashboard endpoint to include a `groupsOverview` array, summarizing student enrollments, quiz attempts, and pass rates per group.

**Architecture:** We will update the `LecturerDashboardSchema` in the `dashboard` module to declare the new shape. Then, we will update `DashboardService.getLecturerDashboard` to fetch all groups, aggregate their enrollments and quiz attempts (along with calculating the pass rate), and return this list alongside the existing overview and material breakdown.

**Tech Stack:** Bun, Elysia, Prisma, Zod

---

### Task 1: Update the Dashboard Schema

**Files:**
- Modify: `src/modules/dashboard/model.ts`

- [ ] **Step 1: Add the new Zod schema for groups overview**

Open `src/modules/dashboard/model.ts` and add `GroupsOverviewItemSchema` before `LecturerDashboardSchema`. Also, update `LecturerDashboardSchema` to include `groupsOverview`.

```typescript
const GroupsOverviewItemSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  totalStudents: z.number().int().nonnegative(),
  avgPassRate: z.number().nonnegative(),
  totalStudentAttempts: z.number().int().nonnegative(),
});

export const LecturerDashboardSchema = z.object({
  overview: LecturerOverviewSchema,
  groupsOverview: z.array(GroupsOverviewItemSchema),
  materialBreakdown: z.array(MaterialBreakdownItemSchema),
});
```

---

### Task 2: Implement Logic in DashboardService

**Files:**
- Modify: `src/modules/dashboard/service.ts`

- [ ] **Step 1: Fetch groups data with enrollments and quizzes**

In `src/modules/dashboard/service.ts`, inside `DashboardService.getLecturerDashboard`, update the `Promise.all` block to also fetch `groupsData`.

```typescript
    const [
      totalMaterials,
      totalQuizzes,
      totalAttemptsCount,
      materialsData,
      quizzesData,
      groupsData,
    ] = await Promise.all([
      prisma.material.count(),
      prisma.quiz.count(),
      prisma.quizAttempt.count(),
      prisma.material.findMany({
        select: {
          id: true,
          title: true,
          materialType: true,
          groupId: true,
        },
      }),
      prisma.quiz.findMany({
        select: {
          id: true,
          groupId: true,
          levelNumber: true,
          QuizAttempt: {
            select: {
              studentId: true,
            },
          },
        },
      }),
      prisma.group.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: { enrollments: true },
          },
          quizzes: {
            select: {
              passThreshold: true,
              QuizAttempt: {
                select: {
                  score: true,
                },
              },
            },
          },
        },
      }),
    ]);
```

- [ ] **Step 2: Calculate `groupsOverview`**

Below the `materialBreakdown` mapping, compute the `groupsOverview` array by iterating over `groupsData`.

```typescript
    const groupsOverview = groupsData.map((group) => {
      let groupTotalAttempts = 0;
      let passedAttempts = 0;
      let scoredAttemptsCount = 0;

      group.quizzes.forEach((quiz) => {
        groupTotalAttempts += quiz.QuizAttempt.length;
        
        quiz.QuizAttempt.forEach((attempt) => {
          if (attempt.score !== null) {
            scoredAttemptsCount++;
            if (attempt.score >= quiz.passThreshold) {
              passedAttempts++;
            }
          }
        });
      });

      const avgPassRate = scoredAttemptsCount > 0 
        ? Number(((passedAttempts / scoredAttemptsCount) * 100).toFixed(1)) 
        : 0;

      return {
        groupId: group.id,
        groupName: group.name,
        totalStudents: group._count.enrollments,
        avgPassRate,
        totalStudentAttempts: groupTotalAttempts,
      };
    });
```

- [ ] **Step 3: Include `groupsOverview` in the return object**

Update the return statement at the end of `getLecturerDashboard`:

```typescript
    return {
      overview: {
        totalMaterials,
        totalQuizzes,
        totalStudentAttempts: totalAttemptsCount,
      },
      groupsOverview,
      materialBreakdown,
    };
```

- [ ] **Step 4: Run typecheck to verify**

Run: `bun run lint`
Expected: Should pass (warnings are acceptable).

---

### Task 3: Update API Documentation

**Files:**
- Modify: `docs/frontend/lecturer-dashboard-api.md`

- [ ] **Step 1: Add `groupsOverview` to the JSON response**

Update the JSON response block under "## 1. General Lecturer Overview" to include `groupsOverview`.

```json
{
  "success": true,
  "message": "Dashboard retrieved successfully",
  "data": {
    "overview": {
      "totalMaterials": 10,
      "totalQuizzes": 5,
      "totalStudentAttempts": 150
    },
    "groupsOverview": [
      {
        "groupId": "grp123xyz...",
        "groupName": "Introduction to Computer Science - Section A",
        "totalStudents": 45,
        "avgPassRate": 82.5,
        "totalStudentAttempts": 120
      }
    ],
    "materialBreakdown": [
      {
        "materialId": "cm123xyz...",
        "title": "Introduction to Python Variables",
        "materialType": "RICH_TEXT",
        "quizCount": 2,
        "levelCount": 1,
        "uniqueStudentsEngaged": 45
      }
    ]
  }
}
```

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files modified are committed together.

```bash
git add .
git commit -m "feat(dashboard): add groupsOverview to lecturer dashboard API"
```
