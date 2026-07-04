# Create a Quiz (US-L2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow lecturers to create leveled quizzes within a group, add fill-in-the-blank questions using keywords, configure material prerequisites, and gate student attempts based on progress.

**Architecture:** 
1. **Schema**: 
   - Move `Quiz` to belong to `Group` (remove `materialId`, add `groupId`).
   - Add `levelNumber` (Int) and `passThreshold` (Float) to `Quiz`.
   - Add `QuizPrerequisite` model linking `Quiz` to `Material`.
   - Add `QuestionKeyword` model linking `QuizQuestion` to blanks in the key answer.
2. **Logic**:
   - Publishing a quiz requires checking that every question has `QuestionKeyword` records.
   - Attempting a quiz checks if `MaterialRead` records exist for all `QuizPrerequisite` materials, and if a passing `QuizAttempt` exists for `levelNumber - 1`.

**Tech Stack:** Bun, Elysia, Prisma, PostgreSQL, Zod

---

### Task 1: Update Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Modify the schema**

```prisma
// 1. Update Quiz Model
model Quiz {
  id            BigInt      @id @default(autoincrement())
  groupId       String
  group         Group       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  title         String
  description   String?     @db.Text
  startTime     DateTime?
  endTime       DateTime?
  isPublished   Boolean     @default(false)
  levelNumber   Int
  passThreshold Float       @default(70.0)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  levels        QuizLevel[]
  prerequisites QuizPrerequisite[]
  
  @@unique([groupId, levelNumber])
}

// 2. Add QuizPrerequisite Model
model QuizPrerequisite {
  id         String   @id @default(cuid())
  quizId     BigInt
  quiz       Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  materialId BigInt
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  
  @@unique([quizId, materialId])
}

// 3. Add QuestionKeyword Model (if not exists)
model QuestionKeyword {
  id            BigInt       @id @default(autoincrement())
  questionId    BigInt
  question      QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  blankOrder    Int
  correctAnswer String       @db.Text
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([questionId, blankOrder])
}

// 4. Update QuizQuestion to link Keywords
// Inside QuizQuestion model:
// keywords QuestionKeyword[]
```

- [ ] **Step 2: Generate and apply migration**

Run: `bunx prisma migrate dev --name create_quiz_group_and_keywords`
Expected: Migration succeeds and Prisma client is generated.

### Task 2: Quiz CRUD & Prerequisites API

**Files:**
- Modify: `src/modules/quiz/schema.ts`
- Modify: `src/modules/quiz/service.ts`
- Modify: `src/modules/quiz/index.ts`
- Modify: `src/__tests__/integration/quiz.test.ts` (or relevant quiz tests)

- [ ] **Step 1: Write failing test**
Create a test in `src/__tests__/integration/quiz.test.ts` that creates a quiz with a `groupId`, `levelNumber`, and an array of `prerequisiteMaterialIds`. 

- [ ] **Step 2: Run test to verify it fails**
Run: `bun test src/__tests__/integration/quiz.test.ts`

- [ ] **Step 3: Update Schemas and Service**
Update `CreateQuizSchema` to require `groupId`, `levelNumber`, and optional `prerequisiteMaterialIds` (array of numbers).
In `QuizService.createQuiz`, wrap in `$transaction`:
1. Create the Quiz with `groupId` and `levelNumber`.
2. Create `QuizPrerequisite` entries for the provided material IDs.

- [ ] **Step 4: Run test to verify it passes**
Run: `bun test src/__tests__/integration/quiz.test.ts`

### Task 3: Quiz Question & Keyword API

**Files:**
- Modify: `src/modules/quiz/question.service.ts` (or wherever question logic lives)
- Modify: `src/modules/quiz/schema.ts`

- [ ] **Step 1: Write failing test**
Create a test for adding a question with keywords (blanks) to a quiz.

- [ ] **Step 2: Update Schemas**
Update `CreateQuestionSchema` to accept an array of `keywords` (each having `blankOrder` and `correctAnswer`).

- [ ] **Step 3: Implement Question Creation**
In the question service, wrap in `$transaction`:
1. Create the `QuizQuestion`.
2. Bulk create the `QuestionKeyword` entries.

- [ ] **Step 4: Run test to verify it passes**

### Task 4: Quiz Publishing Constraints

**Files:**
- Modify: `src/modules/quiz/service.ts`

- [ ] **Step 1: Write failing test**
Write a test that attempts to publish a quiz (`isPublished: true`) where one of its questions has zero keywords. It should return a 400 validation error.

- [ ] **Step 2: Implement Logic**
In `QuizService.updateQuiz`, if `isPublished` is being set to `true`:
1. Query all questions for this quiz.
2. If any question has `_count.keywords === 0`, throw a custom `ValidationError` ("All questions must have at least one blank to be published").

- [ ] **Step 3: Run test to verify it passes**

### Task 5: Quiz Attempt Gates (Prerequisites Checks)

**Files:**
- Modify: `src/modules/quiz/attempt.service.ts` (or where attempt logic lives)

- [ ] **Step 1: Write failing tests**
Write tests for attempting a quiz:
1. Fails if a prerequisite material is not read (no `MaterialRead` record).
2. Fails if `levelNumber > 1` and there is no passing `QuizAttempt` for `levelNumber - 1` in the same group.

- [ ] **Step 2: Implement Gate Logic**
Before creating a `QuizAttempt` for a student:
1. **Material Gate**: Fetch all `QuizPrerequisite` for the quiz. Check if the student has a `MaterialRead` record for each one. If not, throw a `ForbiddenError`.
2. **Level Gate**: If `quiz.levelNumber > 1`, fetch the Quiz in the same `groupId` with `levelNumber - 1`. Check if the student has a `QuizAttempt` for that previous quiz where `score >= quiz.passThreshold`. If not, throw a `ForbiddenError`.

- [ ] **Step 3: Run test to verify it passes**

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

```bash
git add .
git commit -m "feat: implement lecturer quiz creation, fill-in-the-blanks, and prerequisite gates"
```
