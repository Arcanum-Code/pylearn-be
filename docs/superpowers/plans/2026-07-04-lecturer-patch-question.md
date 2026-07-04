# Lecturer Quiz Patch Question Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `PATCH /api/lecturer/questions/{questionId}` endpoint to allow lecturers to update a question's text, key answer, or sequence order. Also gracefully detect if a key answer change invalidates existing blanks.

**Architecture:** 
- Add validation schemas to `schema.ts` and `model.ts`. 
- Implement `updateQuestion` in `LecturerQuizService`. This method updates the question record, optionally checking sequence order conflicts, and validates existing blanks against any new `key_answer_text` to return a `blanks_invalidated` flag if indices shift.
- Expose via `PATCH /questions/:questionId` in the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Update Question Endpoint

**Files:**
- Modify: `src/modules/lecturer/quiz/schema.ts`
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should update a question and return blanks_invalidated if key answer changes invalidly', async () => {
    const role = await createTestRoleWithPermissions('LecturerRolePatchQuestion', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'patch_q@test.com' });

    // Setup group, quiz, question and blank
    const group = await prisma.group.create({ data: { name: "Patch Q Group", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 13, title: 'Patch Q Quiz', passThreshold: 60, isPublished: false }
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "What is an array?",
        answerText: "An array is a data structure.",
        questionOrder: 1
      }
    });
    await prisma.questionKeyword.create({
      data: { questionId: question.id, blankOrder: 1, correctAnswer: "data structure", startIndex: 14, endIndex: 28 }
    });

    const req = new Request(`http://localhost/api/lecturer/questions/q_${question.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        question_text: "What exactly is an array?",
        key_answer_text: "An array represents a data structure.", // Shifted! "data structure" now starts at 22
      })
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body.data.question_text).toBe("What exactly is an array?");
    expect(body.data.key_answer_text).toBe("An array represents a data structure.");
    expect(body.data.blanks_invalidated).toBe(true);
    expect(body.data.message).toBe("Key answer changed; please re-select blanks.");
  });
```

- [ ] **Step 2: Update validation schema**

```typescript
// Append to src/modules/lecturer/quiz/schema.ts

export const updateQuestionSchema = createQuestionSchema.partial();
```

- [ ] **Step 3: Update response models**

```typescript
// Update updateQuestionResponseSchema in src/modules/lecturer/quiz/model.ts
// Add this below createQuestionResponseSchema:

export const updateQuestionResponseSchema = z.object({
  question_id: z.string(),
  quiz_id: z.string(),
  question_text: z.string(),
  key_answer_text: z.string(),
  sequence_order: z.number(),
  blanks: z.array(z.any()),
  blanks_invalidated: z.boolean().optional(),
  message: z.string().optional(),
});

// Expose on LecturerQuizModel:
export const LecturerQuizModel = {
  createResponse: createResponseSchema(createQuizResponseSchema),
  createQuestionResponse: createResponseSchema(createQuestionResponseSchema),
  replaceBlanksResponse: createResponseSchema(replaceBlanksResponseSchema),
  updateQuestionResponse: createResponseSchema(updateQuestionResponseSchema), // Add this line
} as const;
```

- [ ] **Step 4: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async updateQuestion(questionIdStr: string, data: { question_text?: string; key_answer_text?: string; sequence_order?: number }, log: Logger) {
    const questionId = BigInt(questionIdStr.replace("q_", ""));
    
    const question = await prisma.quizQuestion.findUnique({ where: { id: questionId }, include: { keywords: true } });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    if (data.sequence_order !== undefined && data.sequence_order !== question.questionOrder) {
      const sequenceConflict = await prisma.quizQuestion.findUnique({
        where: { quizId_questionOrder: { quizId: question.quizId, questionOrder: data.sequence_order } }
      });
      if (sequenceConflict) {
        throw new LecturerQuizError(422, "quiz.questionOrderExists", { sequence_order: data.sequence_order });
      }
    }

    const updatedQuestion = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        questionText: data.question_text !== undefined ? data.question_text : undefined,
        answerText: data.key_answer_text !== undefined ? data.key_answer_text : undefined,
        questionOrder: data.sequence_order !== undefined ? data.sequence_order : undefined,
      }
    });

    let blanksInvalidated = false;
    let message: string | undefined = undefined;

    if (data.key_answer_text !== undefined && data.key_answer_text !== question.answerText && question.keywords.length > 0) {
      for (const blank of question.keywords) {
        if (blank.startIndex >= blank.endIndex || blank.endIndex > data.key_answer_text.length) {
          blanksInvalidated = true;
          break;
        }
        const actualSubstring = data.key_answer_text.substring(blank.startIndex, blank.endIndex);
        if (actualSubstring !== blank.correctAnswer) {
          blanksInvalidated = true;
          break;
        }
      }
    }

    if (blanksInvalidated) {
      message = "Key answer changed; please re-select blanks.";
    }

    log.info({ questionId: updatedQuestion.id }, "Lecturer updated question");

    return {
      question_id: questionIdStr,
      quiz_id: `qz_${updatedQuestion.quizId}`,
      question_text: updatedQuestion.questionText,
      key_answer_text: updatedQuestion.answerText,
      sequence_order: updatedQuestion.questionOrder,
      blanks: question.keywords.map(b => ({
        blank_id: `b_${b.id}`,
        keyword: b.correctAnswer,
        start_index: b.startIndex,
        end_index: b.endIndex
      })),
      blanks_invalidated: blanksInvalidated ? true : undefined,
      message,
    };
  }
```

- [ ] **Step 5: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts
// Add `updateQuestionSchema` to the import list

  .patch("/questions/:questionId", async ({ set, params, body, log, locale }) => {
    const result = await LecturerQuizService.updateQuestion(params.questionId, body, log);
    return successResponse(set, result, { key: "common.success" }, 200, undefined, locale);
  }, {
    body: updateQuestionSchema,
    response: { 200: LecturerQuizModel.updateQuestionResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "update") // Requires update access
  })
```

- [ ] **Step 6: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer/quiz): implement update question endpoint"
```
