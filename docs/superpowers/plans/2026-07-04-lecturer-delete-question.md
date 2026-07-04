# Lecturer Quiz Delete Question Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `DELETE /api/lecturer/questions/{questionId}` endpoint to allow lecturers to completely remove a question from a quiz.

**Architecture:** 
- Expose a `deleteQuestionResponse` schema in `LecturerQuizModel`.
- Implement `deleteQuestion` in `LecturerQuizService`. This method ensures the question exists, deletes it, and relies on Prisma's database-level `Cascade` delete to automatically clean up all associated `QuestionKeyword` blanks.
- Expose via `DELETE /questions/:questionId` in the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Delete Question Endpoint

**Files:**
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should delete a question and cascade delete its blanks', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleDeleteQuestion', [
      { featureName: 'lecturer_quiz_access', action: 'delete' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'del_q@test.com' });

    // Setup group, quiz, question and blank
    const group = await prisma.group.create({ data: { name: "Delete Q Group", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 14, title: 'Delete Q Quiz', passThreshold: 60, isPublished: false }
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "To be deleted?",
        answerText: "Yes.",
        questionOrder: 1
      }
    });
    const blank = await prisma.questionKeyword.create({
      data: { questionId: question.id, blankOrder: 1, correctAnswer: "Yes", startIndex: 0, endIndex: 3 }
    });

    const req = new Request(`http://localhost/api/lecturer/questions/q_${question.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(204);
    
    // Verify question is deleted
    const deletedQuestion = await prisma.quizQuestion.findUnique({ where: { id: question.id } });
    expect(deletedQuestion).toBeNull();
    
    // Verify blanks are cascade-deleted
    const deletedBlank = await prisma.questionKeyword.findUnique({ where: { id: blank.id } });
    expect(deletedBlank).toBeNull();
  });
```

- [ ] **Step 2: Update response models**

```typescript
// Update LecturerQuizModel in src/modules/lecturer/quiz/model.ts
// Add this below updateQuestionResponse:

  deleteQuestionResponse: createResponseSchema(z.null()), // Add this line
```

- [ ] **Step 3: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async deleteQuestion(questionIdStr: string, log: Logger) {
    const questionId = BigInt(questionIdStr.replace("q_", ""));
    
    const question = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    await prisma.quizQuestion.delete({ where: { id: questionId } });

    log.info({ questionId: question.id }, "Lecturer deleted question (and cascaded blanks)");
  }
```

- [ ] **Step 4: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts

  .delete("/questions/:questionId", async ({ set, params, log, locale }) => {
    await LecturerQuizService.deleteQuestion(params.questionId, log);
    return successResponse(set, null, { key: "common.success" }, 204, undefined, locale);
  }, {
    response: { 204: LecturerQuizModel.deleteQuestionResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "delete") // Requires delete access
  })
```

- [ ] **Step 5: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer/quiz): implement delete question endpoint"
```
