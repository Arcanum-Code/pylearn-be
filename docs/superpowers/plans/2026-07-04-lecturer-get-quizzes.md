# Lecturer Quiz GET Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `GET /api/lecturer/groups/{groupId}/quizzes` and `GET /api/lecturer/quizzes/{quizId}` endpoints for listing all quizzes in a group and retrieving full quiz details for editing.

**Architecture:** 
- Add `listQuizzesResponse` and `getQuizResponse` schemas in `LecturerQuizModel`.
- Implement `listQuizzes` and `getQuiz` in `LecturerQuizService`.
- `listQuizzes` aggregates the `question_count` via Prisma's `_count`.
- `getQuiz` fetches the complete nested graph: quiz → questions → blanks, as well as quiz → group → published materials (for the `gating_materials` array).
- Expose via standard `GET` routes on the `lecturerQuiz` Elysia router.

**Tech Stack:** Bun, Elysia, Prisma, Zod, Pino

---

### Task 1: GET Endpoints

**Files:**
- Modify: `src/modules/lecturer/quiz/model.ts`
- Modify: `src/modules/lecturer/quiz/service.ts`
- Modify: `src/modules/lecturer/quiz/index.ts`
- Modify: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to src/__tests__/integration/lecturer-quiz.test.ts

  it('should list all quizzes in a group', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleListQ', [
      { featureName: 'lecturer_quiz_access', action: 'read' }
    ]);
    const { token } = await createAuthenticatedUser({ roleId: role.id, email: 'list_q@test.com' });

    const group = await prisma.group.create({ data: { name: "List Q Group", description: "Desc" } });
    await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 21, title: 'Quiz 21', passThreshold: 60, isPublished: true }
    });
    await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 22, title: 'Quiz 22', passThreshold: 60, isPublished: false }
    });

    const req = new Request(`http://localhost/api/lecturer/groups/${group.id}/quizzes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body.data.quizzes.length).toBe(2);
    expect(body.data.quizzes[0].level).toBe(21);
    expect(body.data.quizzes[0].status).toBe("published");
    expect(body.data.quizzes[1].level).toBe(22);
    expect(body.data.quizzes[1].status).toBe("draft");
    expect(body.data.quizzes[1].question_count).toBe(0);
  });

  it('should get full quiz details by ID', async () => {
    const role = await createTestRoleWithPermissions('LecturerRoleGetQ', [
      { featureName: 'lecturer_quiz_access', action: 'read' }
    ]);
    const { token, user } = await createAuthenticatedUser({ roleId: role.id, email: 'get_q@test.com' });

    const group = await prisma.group.create({ data: { name: "Get Q Group", description: "Desc" } });
    await prisma.material.create({
      data: { groupId: group.id, lecturerId: user.id, title: "Gate Mat", materialType: "text", isPublished: true }
    });
    const quiz = await prisma.quiz.create({
      data: { groupId: group.id, levelNumber: 23, title: 'Get Quiz', passThreshold: 75, isPublished: false }
    });
    const question = await prisma.quizQuestion.create({
      data: { quizId: quiz.id, questionText: "Q?", answerText: "A", questionOrder: 1 }
    });
    await prisma.questionKeyword.create({
      data: { questionId: question.id, blankOrder: 1, correctAnswer: "A", startIndex: 0, endIndex: 1 }
    });

    const req = new Request(`http://localhost/api/lecturer/quizzes/qz_${quiz.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body.data.quiz_id).toBe(`qz_${quiz.id}`);
    expect(body.data.pass_threshold).toBe(75);
    expect(body.data.status).toBe("draft");
    expect(body.data.questions.length).toBe(1);
    expect(body.data.questions[0].blanks.length).toBe(1);
    expect(body.data.gating_materials.length).toBe(1);
    expect(body.data.gating_materials[0].title).toBe("Gate Mat");
  });
```

- [ ] **Step 2: Update response models**

```typescript
// Update LecturerQuizModel in src/modules/lecturer/quiz/model.ts
// Add this below publishQuizResponse:

  listQuizzesResponse: createResponseSchema(
    z.object({
      quizzes: z.array(
        z.object({
          quiz_id: z.string(),
          level: z.number(),
          title: z.string(),
          status: z.string(),
          question_count: z.number(),
        })
      )
    })
  ),
  getQuizResponse: createResponseSchema(
    z.object({
      quiz_id: z.string(),
      group_id: z.string(),
      level: z.number(),
      title: z.string(),
      status: z.string(),
      pass_threshold: z.number(),
      questions: z.array(
        z.object({
          question_id: z.string(),
          question_text: z.string(),
          key_answer_text: z.string(),
          sequence_order: z.number(),
          blanks: z.array(
            z.object({
              blank_id: z.string(),
              keyword: z.string(),
              start_index: z.number(),
              end_index: z.number(),
            })
          )
        })
      ),
      gating_materials: z.array(
        z.object({
          material_id: z.string(),
          title: z.string(),
          sequence: z.number(),
        })
      )
    })
  ),
```

- [ ] **Step 3: Implement Service Method**

```typescript
// Append to src/modules/lecturer/quiz/service.ts

  static async listQuizzes(groupId: string, log: Logger) {
    const quizzes = await prisma.quiz.findMany({
      where: { groupId },
      include: {
        _count: { select: { questions: true } }
      },
      orderBy: { levelNumber: 'asc' }
    });

    return {
      quizzes: quizzes.map(q => ({
        quiz_id: `qz_${q.id}`,
        level: q.levelNumber,
        title: q.title,
        status: q.isPublished ? "published" : "draft",
        question_count: q._count.questions
      }))
    };
  }

  static async getQuiz(quizIdStr: string, log: Logger) {
    const quizId = BigInt(quizIdStr.replace("qz_", ""));
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { questionOrder: 'asc' },
          include: { keywords: { orderBy: { blankOrder: 'asc' } } }
        },
        group: {
          include: {
            materials: {
              where: { isPublished: true },
              orderBy: { sequence: 'asc' }
            }
          }
        }
      }
    });

    if (!quiz) {
      throw new LecturerQuizError(404, "common.notFound");
    }

    return {
      quiz_id: quizIdStr,
      group_id: quiz.groupId,
      level: quiz.levelNumber,
      title: quiz.title,
      status: quiz.isPublished ? "published" : "draft",
      pass_threshold: quiz.passThreshold,
      questions: quiz.questions.map(q => ({
        question_id: `q_${q.id}`,
        question_text: q.questionText,
        key_answer_text: q.answerText,
        sequence_order: q.questionOrder,
        blanks: q.keywords.map(b => ({
          blank_id: `b_${b.id}`,
          keyword: b.correctAnswer,
          start_index: b.startIndex,
          end_index: b.endIndex,
        }))
      })),
      gating_materials: quiz.group.materials.map(m => ({
        material_id: `m_${m.id}`,
        title: m.title,
        sequence: m.sequence,
      }))
    };
  }
```

- [ ] **Step 4: Implement Router Endpoints**

```typescript
// Append to the lecturerQuiz router chain in src/modules/lecturer/quiz/index.ts

  .get("/groups/:groupId/quizzes", async ({ set, params, log, locale }) => {
    const result = await LecturerQuizService.listQuizzes(params.groupId, log);
    return successResponse(set, result, { key: "common.success" }, 200, undefined, locale);
  }, {
    response: { 200: LecturerQuizModel.listQuizzesResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "read")
  })
  .get("/quizzes/:quizId", async ({ set, params, log, locale }) => {
    const result = await LecturerQuizService.getQuiz(params.quizId, log);
    return successResponse(set, result, { key: "common.success" }, 200, undefined, locale);
  }, {
    response: { 200: LecturerQuizModel.getQuizResponse },
    beforeHandle: hasPermission(FEATURE_NAME, "read")
  })
```

- [ ] **Step 5: Run tests to verify success**
Run: `bun test src/__tests__/integration/lecturer-quiz.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat(lecturer/quiz): implement get quizzes endpoints"
```
