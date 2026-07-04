# Lecturer Quiz Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `POST /api/lecturer/quizzes/{quizId}/questions` endpoint to allow lecturers to add a question to a draft quiz.

**Architecture:** 
- Add validation schemas to `schema.ts` and `model.ts`. 
- Implement `createQuestion` in `LecturerQuizService`. It will check for quiz existence and sequence order uniqueness, then insert the `QuizQuestion`. 
- Expose via `POST /quizzes/:quizId/questions` in the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Create Question Endpoint

**Files:**
- Modify: `src/modules/lecturer/quiz/schema.ts`
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should add a new question to a quiz', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleQuestion', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'question@test.com' });

    // Setup group and quiz
    const group = await prisma.group.create({ data: { name: "Question Group", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 10, title: 'Question Quiz', passThreshold: 60, isPublished: false }
    });
    
    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}/questions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        question_text: "Explain how a for-loop iterates.", 
        key_answer_text: "A for-loop uses range directly.", 
        sequence_order: 1 
      })
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    
    expect(body.data.question_text).toBe("Explain how a for-loop iterates.");
    expect(body.data.key_answer_text).toBe("A for-loop uses range directly.");
    expect(body.data.sequence_order).toBe(1);
    expect(body.data.blanks).toEqual([]);
    expect(body.data.question_id).toBeDefined();
  });
```

- [ ] **Step 2: Update validation schema**

```typescript
// Append to src/modules/lecturer/quiz/schema.ts

export const createQuestionSchema = z.object({
  question_text: z.string().min(1),
  key_answer_text: z.string().min(1),
  sequence_order: z.number().int().min(1),
});
```

- [ ] **Step 3: Update response models**

```typescript
// Append to src/modules/lecturer/quiz/model.ts

export const createQuestionResponseSchema = z.object({
  question_id: z.string(),
  quiz_id: z.string(),
  question_text: z.string(),
  key_answer_text: z.string(),
  sequence_order: z.number(),
  blanks: z.array(z.any()), // Intermediate empty blanks array
});

// Update LecturerQuizModel
export const LecturerQuizModel = {
  createResponse: createResponseSchema(createQuizResponseSchema),
  createQuestionResponse: createResponseSchema(createQuestionResponseSchema), // Add this line
} as const;
```

- [ ] **Step 4: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async createQuestion(quizIdStr: string, data: { question_text: string; key_answer_text: string; sequence_order: number }, log: Logger) {
    const quizId = BigInt(quizIdStr.replace("qz_", ""));
    
    // Check if quiz exists
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    // Check for sequence_order conflict
    const sequenceConflict = await prisma.quizQuestion.findUnique({
      where: { quizId_questionOrder: { quizId, questionOrder: data.sequence_order } }
    });
    
    if (sequenceConflict) {
      throw new LecturerQuizError(422, "quiz.questionOrderExists", { sequence_order: data.sequence_order });
    }

    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
        questionText: data.question_text,
        answerText: data.key_answer_text,
        questionOrder: data.sequence_order,
      }
    });

    log.info({ questionId: question.id, quizId }, "Lecturer added question to quiz");

    return {
      question_id: `q_${question.id}`,
      quiz_id: quizIdStr,
      question_text: question.questionText,
      key_answer_text: question.answerText,
      sequence_order: question.questionOrder,
      blanks: []
    };
  }
```

- [ ] **Step 5: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts
// Add `createQuestionSchema` to the import list

  .post("/quizzes/:quizId/questions", async ({ set, params, body, log, locale }) => {
    const result = await LecturerQuizService.createQuestion(params.quizId, body, log);
    return successResponse(set, result, { key: "common.success" }, 201, undefined, locale);
  }, {
    body: createQuestionSchema,
    response: { 201: LecturerQuizModel.createQuestionResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "update") // Adding a question requires write access to the quiz
  })
```

- [ ] **Step 6: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer/quiz): implement create quiz question endpoint"
```
