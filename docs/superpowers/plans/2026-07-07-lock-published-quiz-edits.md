# Lock Published Quiz Edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent editing quiz questions and quiz metadata when the quiz `isPublished = true`, so student grades are never invalidated by mid-course question changes.

**Architecture:** Add a `checkNotPublished(quizId)` helper in `LecturerQuizService` that fetches the quiz's `isPublished` flag and throws `LecturerQuizError(400, ...)` if true. Call it at the top of every mutation method (`updateQuiz`, `createQuestion`, `replaceBlanks`, `updateQuestion`, `deleteQuestion`). Add a new locale key `quizPublishedNotEditable` in all three language files. Write one integration test per guarded operation confirming a 400 response.

**Tech Stack:** Bun, Elysia, Prisma, Zod

---

## File Structure

| File | Change |
|------|--------|
| `src/modules/lecturer/quiz/service.ts` | Add `checkNotPublished()` helper + guard calls in 5 mutation methods |
| `src/locales/en.ts` | Add `quizPublishedNotEditable: "Cannot modify a published quiz"` |
| `src/locales/id.ts` | Add `quizPublishedNotEditable: "Tidak dapat mengubah kuis yang sudah dipublikasikan"` |
| `src/locales/es.ts` | Add `quizPublishedNotEditable: "No se puede modificar un cuestionario publicado"` |
| `src/__tests__/lecturer/quiz-publish.test.ts` | Add tests: createQuestion, updateQuestion, deleteQuestion, replaceBlanks, updateQuiz all fail with 400 on published quiz |

---

### Task 1: Add locale keys

**Files:**
- Modify: `src/locales/en.ts:14`
- Modify: `src/locales/id.ts:14`
- Modify: `src/locales/es.ts:14`

- [ ] **Step 1: Add key to English locale**

```typescript
// src/locales/en.ts — insert after quizDeleteConflict line
  quizDeleteConflict:
    "Cannot delete a published quiz that has student attempts.",
  quizPublishedNotEditable:
    "Cannot modify a published quiz. Unpublish it first to make changes.",
```

- [ ] **Step 2: Add key to Indonesian locale**

```typescript
// src/locales/id.ts — insert after quizDeleteConflict line
  quizDeleteConflict:
    "Tidak dapat menghapus kuis yang sudah dipublikasikan dan memiliki percobaan siswa.",
  quizPublishedNotEditable:
    "Tidak dapat mengubah kuis yang sudah dipublikasikan. Publikasikan ulang setelah perubahan.",
```

- [ ] **Step 3: Add key to Spanish locale**

```typescript
// src/locales/es.ts — insert after quizDeleteConflict line
  quizDeleteConflict:
    "No se puede eliminar un cuestionario publicado que tiene intentos de estudiantes.",
  quizPublishedNotEditable:
    "No se puede modificar un cuestionario publicado. Despublíquelo primero para hacer cambios.",
```

---

### Task 2: Add guard helper + guard calls in service.ts

**Files:**
- Modify: `src/modules/lecturer/quiz/service.ts`

- [ ] **Step 1: Add `checkNotPublished` helper method**

Insert this static method inside `LecturerQuizService` class (after `createQuiz`, before `updateQuiz`):

```typescript
  static async checkNotPublished(quizId: bigint) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { isPublished: true },
    });
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }
    if (quiz.isPublished) {
      throw new LecturerQuizError(400, "common.quizPublishedNotEditable");
    }
  }
```

- [ ] **Step 2: Guard `updateQuiz`**

At `service.ts:51`, right after the `existing` check (line 52-55), add:

```typescript
    // Also guard if quiz is published
    if (existing.isPublished) {
      throw new LecturerQuizError(400, "common.quizPublishedNotEditable");
    }
```

(No need to call the helper since we already have the `existing` record fetched.)

- [ ] **Step 3: Guard `createQuestion`**

At `service.ts:118-120`, after the quiz existence check, change from:

```typescript
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }
```

To:

```typescript
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, isPublished: true },
    });
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }
    if (quiz.isPublished) {
      throw new LecturerQuizError(400, "common.quizPublishedNotEditable");
    }
```

- [ ] **Step 4: Guard `replaceBlanks`**

At `service.ts:169-174`, change from:

```typescript
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }
```

To:

```typescript
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: {
        quiz: { select: { isPublished: true } },
      },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }
    if (question.quiz.isPublished) {
      throw new LecturerQuizError(400, "common.quizPublishedNotEditable");
    }
```

Then update the `question` variable usage below — the existing code later uses `question.id`, `question.answerText`, `question.keywords` — all still accessible since we're using `include` (not changing the select shape).

- [ ] **Step 5: Guard `updateQuestion`**

At `service.ts:249-252`, change from:

```typescript
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: { keywords: true },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }
```

To:

```typescript
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: {
        keywords: true,
        quiz: { select: { isPublished: true } },
      },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }
    if (question.quiz.isPublished) {
      throw new LecturerQuizError(400, "common.quizPublishedNotEditable");
    }
```

- [ ] **Step 6: Guard `deleteQuestion`**

At `service.ts:341-346`, change from:

```typescript
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }
```

To:

```typescript
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: {
        quiz: { select: { isPublished: true } },
      },
    });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }
    if (question.quiz.isPublished) {
      throw new LecturerQuizError(400, "common.quizPublishedNotEditable");
    }
```

---

### Task 3: Add integration tests

**Files:**
- Modify: `src/__tests__/lecturer/quiz-publish.test.ts`

- [ ] **Step 1: Add test for createQuestion on published quiz**

Add inside the `describe("Lecturer Quiz API - Publish")` block after the existing tests:

```typescript
  it("should reject adding a question to a published quiz", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePubEdit1",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_edit1@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Edit Group", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 30,
        title: "Pub Edit Quiz",
        passThreshold: 60,
        isPublished: true,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}/questions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_text: "New question?",
          key_answer_text: "New answer.",
          sequence_order: 1,
        }),
      },
    );
    const res = await app.handle(req);
    expect(res.status).toBe(400);
  });

  it("should reject updating a question on a published quiz", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePubEdit2",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_edit2@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Edit Group 2", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 31,
        title: "Pub Edit Quiz 2",
        passThreshold: 60,
        isPublished: true,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Original?",
        answerText: "Original answer.",
        maxScore: 100,
        questionOrder: 1,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question_text: "Changed?" }),
      },
    );
    const res = await app.handle(req);
    expect(res.status).toBe(400);
  });

  it("should reject deleting a question on a published quiz", async () => {
    const deleteRole = await createTestRoleWithPermissions(
      "LecturerRolePubEdit3",
      [{ featureName: "lecturer_quiz_access", action: "delete" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: deleteRole.id,
      email: "pub_edit3@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Edit Group 3", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 32,
        title: "Pub Edit Quiz 3",
        passThreshold: 60,
        isPublished: true,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Delete me?",
        answerText: "Delete answer.",
        maxScore: 100,
        questionOrder: 1,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    const res = await app.handle(req);
    expect(res.status).toBe(400);
  });

  it("should reject replacing blanks on a published quiz", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePubEdit4",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_edit4@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Edit Group 4", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 33,
        title: "Pub Edit Quiz 4",
        passThreshold: 60,
        isPublished: true,
      },
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "Blanks question",
        answerText: "The answer is here.",
        maxScore: 100,
        questionOrder: 1,
      },
    });
    await prisma.questionKeyword.create({
      data: {
        questionId: question.id,
        blankOrder: 1,
        correctAnswer: "answer",
        startIndex: 12,
        endIndex: 18,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/questions/q_${question.id}/blanks`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blanks: [{ keyword: "answer", start_index: 12, end_index: 18 }],
        }),
      },
    );
    const res = await app.handle(req);
    expect(res.status).toBe(400);
  });

  it("should reject updating quiz metadata on a published quiz", async () => {
    const role = await createTestRoleWithPermissions(
      "LecturerRolePubEdit5",
      [{ featureName: "lecturer_quiz_access", action: "update" }],
    );
    const { token } = await createAuthenticatedUser({
      roleId: role.id,
      email: "pub_edit5@test.com",
    });

    const group = await prisma.group.create({
      data: { name: "Pub Edit Group 5", description: "Desc" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        groupId: group.id,
        levelNumber: 34,
        title: "Pub Edit Quiz 5",
        passThreshold: 60,
        isPublished: true,
      },
    });

    const req = new Request(
      `http://localhost/api/lecturer/quizzes/qz_${quiz.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Changed Title" }),
      },
    );
    const res = await app.handle(req);
    expect(res.status).toBe(400);
  });
```

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add src/modules/lecturer/quiz/service.ts src/locales/en.ts src/locales/id.ts src/locales/es.ts src/__tests__/lecturer/quiz-publish.test.ts
git commit -m "feat: prevent editing published quizzes"
```
