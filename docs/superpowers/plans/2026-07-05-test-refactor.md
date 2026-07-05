# Test Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor monolithic integration test files from `src/__tests__/integration/` into feature-specific directories, with one file per endpoint or logic unit, adhering to the project's testing conventions. Any service-level tests will be removed as the project only uses integration tests.

**Architecture:** We will create new directories for features like `group`, `quiz/lecturer`, and `student/materials` inside `src/__tests__/`. For each monolithic file, we will read its contents, extract individual `it(...)` blocks (or logical groups of tests) along with their required imports and setup logic, and write them into focused test files. Service tests will be deleted. Once all tests are moved and verified, the old monolithic files will be deleted.

**Tech Stack:** Bun, Elysia, Prisma, TypeScript (Bun test runner)

---

### Task 1: Delete Materials Service Tests

**Files:**
- Delete: `src/__tests__/integration/materials.test.ts`

- [ ] **Step 1: Delete the service tests**
Run: `rm src/__tests__/integration/materials.test.ts`
(These were service-level tests which are not used in this codebase).

---

### Task 2: Refactor Student Material API Tests

**Files:**
- Create: `src/__tests__/student/material-list.test.ts`
- Create: `src/__tests__/student/material-detail.test.ts`
- Create: `src/__tests__/student/material-progress.test.ts`
- Delete: `src/__tests__/integration/student-material.test.ts`

- [ ] **Step 1: Extract material list test**
Read `src/__tests__/integration/student-material.test.ts`. Extract the `it("should get group materials with default progress")` test into a new `describe("Student Material API - List")` block in `src/__tests__/student/material-list.test.ts`. Ensure all setup hooks (like user creation, authentication, seeding) are included.

- [ ] **Step 2: Extract material detail test**
Extract the `it("should get material detail and auto-create in_progress state")` test into `src/__tests__/student/material-detail.test.ts`. Include setup hooks.

- [ ] **Step 3: Extract material progress tests**
Extract the `it("should update progress to completed")` and `it("should update progress to in_progress with partial scroll")` tests into `src/__tests__/student/material-progress.test.ts`. Include setup hooks.

- [ ] **Step 4: Verify Student Material tests**
Run: `bun test src/__tests__/student/`
Expected: PASS

- [ ] **Step 5: Delete the old integration file**
Run: `rm src/__tests__/integration/student-material.test.ts`

---

### Task 3: Refactor Group Module Tests

**Files:**
- Create: `src/__tests__/group/create.test.ts`
- Create: `src/__tests__/group/list.test.ts`
- Create: `src/__tests__/group/get.test.ts`
- Create: `src/__tests__/group/update.test.ts`
- Create: `src/__tests__/group/delete.test.ts`
- Delete: `src/__tests__/integration/group.test.ts`

- [ ] **Step 1: Extract Group API tests into 5 files and discard service tests**
Read `src/__tests__/integration/group.test.ts`. The `describe("API Endpoints")` block currently tests 5 endpoints. Distribute the integration tests into the 5 corresponding files:
- Extract tests covering the create group endpoint into `src/__tests__/group/create.test.ts`.
- Extract tests covering the get all groups endpoint into `src/__tests__/group/list.test.ts`.
- Extract tests covering the get group by ID endpoint into `src/__tests__/group/get.test.ts`.
- Extract tests covering the update group endpoint into `src/__tests__/group/update.test.ts`.
- Extract tests covering the delete group endpoint into `src/__tests__/group/delete.test.ts`.
Ensure all 5 files include their required imports and setup hooks. The `describe("GroupService")` block will be discarded as it contains service-level tests.

- [ ] **Step 2: Verify Group tests**
Run: `bun test src/__tests__/group/`
Expected: PASS

- [ ] **Step 3: Delete the old integration file**
Run: `rm src/__tests__/integration/group.test.ts`

---

### Task 4: Refactor Lecturer Quiz API Tests

**Files:**
- Create: `src/__tests__/lecturer/quiz-draft.test.ts`
- Create: `src/__tests__/lecturer/quiz-question.test.ts`
- Create: `src/__tests__/lecturer/quiz-publish.test.ts`
- Create: `src/__tests__/lecturer/quiz-list.test.ts`
- Delete: `src/__tests__/integration/lecturer-quiz.test.ts`

- [ ] **Step 1: Extract draft and metadata tests**
Read `src/__tests__/integration/lecturer-quiz.test.ts`. Extract tests related to creating drafts, updating metadata, getting full details, and deleting drafts into `src/__tests__/lecturer/quiz-draft.test.ts`. Include all necessary setup logic (creating lecturers, groups, authenticating).

- [ ] **Step 2: Extract question and blanks tests**
Extract tests for adding questions, defining blanks, invalidating blanks, and deleting questions into `src/__tests__/lecturer/quiz-question.test.ts`.

- [ ] **Step 3: Extract publish tests**
Extract tests for publishing quizzes and the validations around publishing (e.g., rejecting if no published materials, rejecting if question has no blanks, rejecting deleting published quizzes with attempts) into `src/__tests__/lecturer/quiz-publish.test.ts`.

- [ ] **Step 4: Extract listing tests**
Extract the test for listing all quizzes in a group into `src/__tests__/lecturer/quiz-list.test.ts`.

- [ ] **Step 5: Verify Lecturer Quiz tests**
Run: `bun test src/__tests__/lecturer/`
Expected: PASS

- [ ] **Step 6: Delete the old integration file**
Run: `rm src/__tests__/integration/lecturer-quiz.test.ts`

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add src/__tests__/
git commit -m "test: refactor monolithic tests and remove service-level tests"
```
