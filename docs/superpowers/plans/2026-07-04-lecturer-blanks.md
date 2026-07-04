# Lecturer Quiz Blanks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `PUT /api/lecturer/questions/{questionId}/blanks` endpoint to allow lecturers to define blanks for a specific question, fully replacing any existing blanks.

**Architecture:** 
- Add validation schemas to `schema.ts` and `model.ts`. 
- Implement `replaceBlanks` in `LecturerQuizService`. This method will validate substrings, delete existing `QuestionKeyword` entries, and insert new ones within a transaction.
- Expose via `PUT /questions/:questionId/blanks` in the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: Replace Question Blanks Endpoint

**Files:**
- Modify: `src/modules/lecturer/quiz/schema.ts`
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should define blanks for a question successfully', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleBlanks', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'blanks@test.com' });

    // Setup group, quiz and question
    const group = await prisma.group.create({ data: { name: "Blank Group", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 11, title: 'Blank Quiz', passThreshold: 60, isPublished: false }
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "What is an array?",
        answerText: "An array is a data structure consisting of a collection of elements.",
        questionOrder: 1
      }
    });

    const req = new Request(`http://localhost/api/lecturer/questions/q_${question.id}/blanks`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        blanks: [
          { keyword: "data structure", start_index: 14, end_index: 28 },
          { keyword: "elements", start_index: 63, end_index: 71 }
        ]
      })
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body.data.question_id).toBe(`q_${question.id}`);
    expect(body.data.blanks.length).toBe(2);
    expect(body.data.blanks[0].keyword).toBe("data structure");
    expect(body.data.blanks[0].blank_id).toBeDefined();
  });

  it('should reject blanks that do not match the key answer text', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleBlanksFail', [
      { featureName: 'lecturer_quiz_access', action: 'update' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'blanks2@test.com' });

    const group = await prisma.group.create({ data: { name: "Blank Group 2", description: "Desc" } });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 12, title: 'Blank Quiz 2', passThreshold: 60, isPublished: false }
    });
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: "What is an array?",
        answerText: "An array is a data structure.",
        questionOrder: 1
      }
    });

    const req = new Request(`http://localhost/api/lecturer/questions/q_${question.id}/blanks`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        blanks: [
          { keyword: "data structure", start_index: 0, end_index: 14 } // Incorrect indices!
        ]
      })
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(422); // Validation Error expected
  });
```

- [ ] **Step 2: Update validation schema**

```typescript
// Append to src/modules/lecturer/quiz/schema.ts

export const replaceBlanksSchema = z.object({
  blanks: z.array(
    z.object({
      keyword: z.string().min(1),
      start_index: z.number().int().min(0),
      end_index: z.number().int().min(0),
    })
  )
});
```

- [ ] **Step 3: Update response models**

```typescript
// Append to src/modules/lecturer/quiz/model.ts

export const replaceBlanksResponseSchema = z.object({
  question_id: z.string(),
  blanks: z.array(
    z.object({
      blank_id: z.string(),
      keyword: z.string(),
      start_index: z.number(),
      end_index: z.number(),
    })
  )
});

// Update LecturerQuizModel
export const LecturerQuizModel = {
  createResponse: createResponseSchema(createQuizResponseSchema),
  createQuestionResponse: createResponseSchema(createQuestionResponseSchema),
  replaceBlanksResponse: createResponseSchema(replaceBlanksResponseSchema), // Add this line
} as const;
```

- [ ] **Step 4: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async replaceBlanks(questionIdStr: string, data: { blanks: { keyword: string; start_index: number; end_index: number }[] }, log: Logger) {
    const questionId = BigInt(questionIdStr.replace("q_", ""));
    
    const question = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    // Validate that each blank exactly matches the answerText substring
    for (const blank of data.blanks) {
      if (blank.start_index >= blank.end_index || blank.end_index > question.answerText.length) {
        throw new LecturerQuizError(422, "quiz.invalidBlankIndices", { blank });
      }
      const actualSubstring = question.answerText.substring(blank.start_index, blank.end_index);
      if (actualSubstring !== blank.keyword) {
        throw new LecturerQuizError(422, "quiz.blankMismatch", { expected: blank.keyword, actual: actualSubstring });
      }
    }

    // Sort blanks by start_index to guarantee sequential blankOrder
    const sortedBlanks = [...data.blanks].sort((a, b) => a.start_index - b.start_index);

    // Run delete + inserts in a transaction to return IDs safely
    const createdBlanks = await prisma.$transaction(async (tx) => {
      await tx.questionKeyword.deleteMany({ where: { questionId } });
      
      const results = [];
      for (let i = 0; i < sortedBlanks.length; i++) {
        const blank = sortedBlanks[i];
        const newBlank = await tx.questionKeyword.create({
          data: {
            questionId,
            blankOrder: i + 1,
            correctAnswer: blank.keyword,
            startIndex: blank.start_index,
            endIndex: blank.end_index,
          }
        });
        results.push(newBlank);
      }
      return results;
    });

    log.info({ questionId: question.id, blanksCount: createdBlanks.length }, "Lecturer replaced question blanks");

    return {
      question_id: questionIdStr,
      blanks: createdBlanks.map(b => ({
        blank_id: `b_${b.id}`,
        keyword: b.correctAnswer,
        start_index: b.startIndex,
        end_index: b.endIndex
      }))
    };
  }
```

- [ ] **Step 5: Implement Router Endpoint**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts
// Add `replaceBlanksSchema` to the import list

  .put("/questions/:questionId/blanks", async ({ set, params, body, log, locale }) => {
    const result = await LecturerQuizService.replaceBlanks(params.questionId, body, log);
    return successResponse(set, result, { key: "common.success" }, 200, undefined, locale);
  }, {
    body: replaceBlanksSchema,
    response: { 200: LecturerQuizModel.replaceBlanksResponse },
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
git commit -m "feat(lecturer/quiz): implement replace question blanks endpoint"
```
