# Lecturer Quiz Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `DELETE /api/lecturer/quizzes/{quizId}` endpoint to delete a quiz. If the quiz is published and has attempts, the endpoint must reject the request with a `409 Conflict` to prevent silent deletion of graded history.

**Architecture:** 
- Add `deleteQuizResponse` schema in `LecturerQuizModel` mapping to `z.null()`.
- Implement `deleteQuiz` in `LecturerQuizService`. This method checks if the quiz exists. If `isPublished` is true, it queries `prisma.quizAttempt.count` to check for student attempts. If `attempts > 0`, it throws a 409 conflict error. Otherwise, it executes the delete.
- Expose via `DELETE /quizzes/:quizId` in the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Delete Quiz Endpoint

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/id.ts`
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Update locale files**

Add the translation under the `common` export block.

In `src/locales/en.ts`:
```typescript
  quizDeleteConflict: "Cannot delete a published quiz that has student attempts.",
```

In `src/locales/es.ts`:
```typescript
  quizDeleteConflict: "No se puede eliminar un cuestionario publicado que tiene intentos de estudiantes.",
```

In `src/locales/id.ts`:
```typescript
  quizDeleteConflict: "Tidak dapat menghapus kuis yang sudah dipublikasikan dan memiliki percobaan siswa.",
```

- [ ] **Step 2: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should reject deleting a published quiz that has attempts', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleDelQFail', [
      { featureName: 'lecturer_quiz_access', action: 'delete' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'del_q_fail@test.com' });

    const group = await prisma.group.create({ data: { name: "Del Q Group 1", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 24, title: 'Del Q Fail', passThreshold: 60, isPublished: true }
    });
    
    // Simulate student attempt
    const studentUser = await createAuthenticatedUser({ roleId: role.id, email: 'student1@test.com' });
    await prisma.quizAttempt.create({
      data: { quizId: quiz.id, studentId: studentUser.user.id, attemptNumber: 1, score: 100, isPassed: true }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe("Cannot delete a published quiz that has student attempts.");
  });

  it('should successfully delete a draft quiz', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleDelQSuccess', [
      { featureName: 'lecturer_quiz_access', action: 'delete' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'del_q_ok@test.com' });

    const group = await prisma.group.create({ data: { name: "Del Q Group 2", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 25, title: 'Del Q Success', passThreshold: 60, isPublished: false }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(204);
    
    // Verify deletion
    const deletedQuiz = await prisma.quiz.findUnique({ where: { id: quiz.id } });
    expect(deletedQuiz).toBeNull();
  });
```

- [ ] **Step 3: Update response models**

```typescript
// Update LecturerQuizModel in src/modules/lecturer/quiz/model.ts
// Add this below getQuizResponse:

  deleteQuizResponse: createResponseSchema(z.null()), // Add this line
```

- [ ] **Step 4: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async deleteQuiz(quizIdStr: string, log: Logger) {
    const quizId = BigInt(quizIdStr.replace("qz_", ""));
    
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    if (quiz.isPublished) {
      const attemptCount = await prisma.quizAttempt.count({
        where: { quizId }
      });
      if (attemptCount > 0) {
        throw new LecturerQuizError(409, "common.quizDeleteConflict");
      }
    }

    await prisma.quiz.delete({ where: { id: quizId } });

    log.info({ quizId: quiz.id }, "Lecturer deleted quiz");
  }
```

- [ ] **Step 5: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts

  .delete("/quizzes/:quizId", async ({ set, params, log, locale }) => {
    await LecturerQuizService.deleteQuiz(params.quizId, log);
    return successResponse(set, null, { key: "common.success" }, 204, undefined, locale);
  }, {
    response: { 204: LecturerQuizModel.deleteQuizResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "delete")
  })
```

- [ ] **Step 5: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer/quiz): implement delete quiz endpoint"
```
