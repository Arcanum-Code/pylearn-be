# Lecturer Quiz Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `PATCH /api/lecturer/quizzes/{quizId}` endpoint to allow lecturers to update quiz metadata, handling level conflicts and emitting warnings if attempts exist.

**Architecture:** Add `updateQuiz` to `LecturerQuizService`, utilizing the existing `updateQuizSchema`. Modify the response schema to allow an optional `warning` field within the data payload. Add a `PATCH` route to the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Update Quiz Metadata Endpoint

**Files:**
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should update quiz metadata and return warning if attempts exist', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleUpdate', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'update@test.com' });

    // Setup group and quiz
    const group = await prisma.group.create({ data: { name: "Update Group", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 5, title: 'Old Title', passThreshold: 60, isPublished: false }
    });
    
    // Create an attempt to trigger the warning logic
    const studentUser = await createTestUser({ email: 'student2@test.com' });
    await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: studentUser.id, attemptNumber: 1 }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title', pass_threshold: 75 })
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body.data.title).toBe('New Title');
    expect(body.data.pass_threshold).toBe(75);
    expect(body.data.warning).toBeDefined();
    expect(body.data.warning).toContain("existing attempts");
  });
```

- [ ] **Step 2: Run tests to verify failure**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Update response schema**

```typescript
// Modify src/modules/lecturer/quiz/model.ts
// Add warning: z.string().optional() to the createQuizResponseSchema

export const createQuizResponseSchema = z.object({
  quiz_id: z.string(),
  group_id: z.string(),
  level: z.number(),
  title: z.string(),
  pass_threshold: z.number(),
  status: z.string(),
  questions: z.array(z.any()),
  warning: z.string().optional(), // <--- Added this line
});
```

- [ ] **Step 4: Implement Service Method**

```typescript
// Add to src/modules/lecturer/quiz/service.ts

  static async updateQuiz(quizIdStr: string, data: { level?: number; title?: string; pass_threshold?: number }, log: Logger) {
    const id = BigInt(quizIdStr.replace("qz_", ""));
    const existing = await prisma.quiz.findUnique({
      where: { id },
      include: { _count: { select: { QuizAttempt: true } } }
    });

    if (!existing) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    if (data.level !== undefined && data.level !== existing.levelNumber) {
      const levelConflict = await prisma.quiz.findUnique({
        where: { groupId_levelNumber: { groupId: existing.groupId, levelNumber: data.level } }
      });
      if (levelConflict) {
        throw new LecturerQuizError(422, "quiz.levelExists", { quiz_id: `qz_${levelConflict.id}`, title: levelConflict.title });
      }
    }

    const quiz = await prisma.quiz.update({
      where: { id },
      data: {
        levelNumber: data.level,
        title: data.title,
        passThreshold: data.pass_threshold,
      }
    });

    log.info({ quizId: quiz.id }, "Lecturer updated quiz metadata");

    let warning: string | undefined;
    if (existing._count.QuizAttempt > 0) {
      warning = `This quiz has ${existing._count.QuizAttempt} existing attempts; past scores will not be recalculated.`;
    }

    return {
      quiz_id: `qz_${quiz.id}`,
      group_id: quiz.groupId,
      level: quiz.levelNumber,
      title: quiz.title,
      pass_threshold: quiz.passThreshold,
      status: quiz.isPublished ? "published" : "draft",
      questions: [], 
      warning
    };
  }
```

- [ ] **Step 5: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts

  .patch("/quizzes/:quizId", async ({ set, params, body, log, locale }) => {
    const result = await LecturerQuizService.updateQuiz(params.quizId, body, log);
    return successResponse(set, result, { key: "common.success" }, 200, undefined, locale);
  }, {
    body: updateQuizSchema,
    response: { 200: LecturerQuizModel.createResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "update")
  })
```

- [ ] **Step 6: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat(lecturer/quiz): implement quiz metadata update endpoint"
```
