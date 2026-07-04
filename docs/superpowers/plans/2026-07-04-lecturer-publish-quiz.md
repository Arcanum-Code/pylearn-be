# Lecturer Quiz Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `POST /api/lecturer/quizzes/{quizId}/publish` endpoint to enforce validation rules (materials gate and question blanks) and transition the quiz status from draft to published.

**Architecture:** 
- Expose a `publishQuizResponse` schema in `LecturerQuizModel`.
- Implement `publishQuiz` in `LecturerQuizService`. It will run the two required validations: 1) Group has >=1 published material, and 2) Every question has >=1 blank. If validation fails, it throws a 422 error with an array of issues. Otherwise it updates `isPublished` to true.
- Expose via `POST /quizzes/:quizId/publish` in the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Publish Quiz Endpoint

**Files:**
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should reject publish if no published materials exist in group', async () => {
    const role = await createTestRoleWithPermissions('LecturerRolePublishFailMat', [
      { featureName: 'lecturer_quiz_access', action: 'update' } // Publishing uses update permissions
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'pub_fail1@test.com' });

    const group = await prisma.group.create({ data: { name: "Pub Fail Group 1", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 15, title: 'Pub Fail Quiz 1', passThreshold: 60, isPublished: false }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues.errors.length).toBeGreaterThan(0);
    expect(body.issues.errors[0].code).toBe("no_materials_in_group");
  });

  it('should reject publish if a question has no blanks', async () => {
    const role = await createTestRoleWithPermissions('LecturerRolePublishFailBlank', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token, user } = await createAuthenticatedUser({ roleId: role.id, email: 'pub_fail2@test.com' });

    const group = await prisma.group.create({ data: { name: "Pub Fail Group 2", description: "Desc" } });
    // Add a published material so it passes the material check
    await prisma.material.create({
      data: {
        groupId: group.id, lecturerId: user.id, title: "Mat", materialType: "text", isPublished: true
      }
    });

    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 16, title: 'Pub Fail Quiz 2', passThreshold: 60, isPublished: false }
    });
    
    // Add question without blanks
    const question = await prisma.quizQuestion.create({
      data: { quizId: quiz.id, questionText: "Q", answerText: "A", questionOrder: 1 }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues.errors.length).toBeGreaterThan(0);
    expect(body.issues.errors[0].code).toBe("question_missing_blanks");
    expect(body.issues.errors[0].question_id).toBe(`q_${question.id}`);
  });

  it('should successfully publish a quiz', async () => {
    const role = await createTestRoleWithPermissions('LecturerRolePublishSuccess', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token, user } = await createAuthenticatedUser({ roleId: role.id, email: 'pub_ok@test.com' });

    const group = await prisma.group.create({ data: { name: "Pub OK Group", description: "Desc" } });
    await prisma.material.create({
      data: {
        groupId: group.id, lecturerId: user.id, title: "Mat", materialType: "text", isPublished: true
      }
    });

    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 17, title: 'Pub OK Quiz', passThreshold: 60, isPublished: false }
    });
    
    const question = await prisma.quizQuestion.create({
      data: { quizId: quiz.id, questionText: "Q", answerText: "A", questionOrder: 1 }
    });
    await prisma.questionKeyword.create({
      data: { questionId: question.id, blankOrder: 1, correctAnswer: "A", startIndex: 0, endIndex: 1 }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.quiz_id).toBe(`qz_${quiz.id}`);
    expect(body.data.status).toBe("published");
    
    // Check DB
    const dbQuiz = await prisma.quiz.findUnique({ where: { id: quiz.id } });
    expect(dbQuiz?.isPublished).toBe(true);
  });
```

- [ ] **Step 2: Update response models**

```typescript
// Update LecturerQuizModel in src/modules/lecturer/quiz/model.ts
// Add this below deleteQuestionResponse:

  publishQuizResponse: createResponseSchema(
    z.object({
      quiz_id: z.string(),
      status: z.string(),
    })
  ), // Add this line
```

- [ ] **Step 3: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async publishQuiz(quizIdStr: string, log: Logger) {
    const quizId = BigInt(quizIdStr.replace("qz_", ""));
    
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: { keywords: true }
        }
      }
    });
    
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    const errors: any[] = [];

    // Validation 1: Group has published materials
    const publishedMaterialsCount = await prisma.material.count({
      where: { groupId: quiz.groupId, isPublished: true }
    });
    if (publishedMaterialsCount === 0) {
      errors.push({
        code: "no_materials_in_group",
        message: "This group has no published materials yet, so this quiz cannot be gated."
      });
    }

    // Validation 2: Every question has >= 1 blank
    for (const q of quiz.questions) {
      if (q.keywords.length === 0) {
        errors.push({
          code: "question_missing_blanks",
          question_id: `q_${q.id}`,
          message: "This question has no blanks defined."
        });
      }
    }

    if (errors.length > 0) {
      throw new LecturerQuizError(422, "quiz.publishValidationFailed", {
        status: "draft",
        errors
      });
    }

    // Pass all validations -> Update to published
    await prisma.quiz.update({
      where: { id: quizId },
      data: { isPublished: true }
    });

    log.info({ quizId: quiz.id }, "Lecturer published quiz");

    return {
      quiz_id: quizIdStr,
      status: "published"
    };
  }
```

- [ ] **Step 4: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts

  .post("/quizzes/:quizId/publish", async ({ set, params, log, locale }) => {
    const result = await LecturerQuizService.publishQuiz(params.quizId, log);
    return successResponse(set, result, { key: "common.success" }, 200, undefined, locale);
  }, {
    response: { 200: LecturerQuizModel.publishQuizResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "update") // Requires update access
  })
```

- [ ] **Step 5: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer/quiz): implement publish quiz endpoint"
```
