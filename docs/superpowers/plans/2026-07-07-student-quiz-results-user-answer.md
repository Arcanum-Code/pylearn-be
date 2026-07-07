# Student Quiz Results — Constructed `userAnswer` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `userAnswer` in `GET /student/quizzes/attempts/:id/results` meaningful for blank questions by constructing it from `correctAnswer` with the user's actual blank answers substituted in, while keeping the existing `blanks` array for per-blank detail.

**Architecture:** The results endpoint currently returns `userAnswer: null` for blank questions because students fill blanks via individual `QuizAnswerItem` records, not a full text. We reuse the same construction pattern already used in `getStudentQuestions()` (which builds `blankQuestionText` by replacing blank spans with `[blank_N]`) — but instead of `[blank_N]`, we substitute the user's actual `answerText` from `QuizAnswerItem`. The `blanks` array, `correctAnswer`, and per-blank `isCorrect` all remain untouched.

**Tech Stack:** Bun, Elysia, Prisma, Zod

---

## File Structure

| File | Change |
|------|--------|
| `src/modules/student/quiz/service.ts` | In `getAttemptResults()`, construct `userAnswer` for blank questions by substituting user's blank answers into `correctAnswer` |
| `src/__tests__/student/quiz/blank-question.test.ts` | Add assertion for the constructed `userAnswer` in the results test |

No model/schema changes needed — `userAnswer` is already `z.string().nullable()` in `QuizResultQuestionSafe`, and the constructed string fits.

---

### Task 1: Update service to construct `userAnswer`

**Files:**
- Modify: `src/modules/student/quiz/service.ts:525-543`

- [ ] **Step 1: Replace the empty/null `userAnswer` with a constructed version for blank questions**

Current code at `src/modules/student/quiz/service.ts:525-543`:
```typescript
      const userAnswerRecord = attempt.answers.find(
        (a) => a.quizQuestionId === question.id,
      );

      const isBlankQuestion = question.keywords.length > 0;
      let blanksBreakdown: any[] = [];

      if (isBlankQuestion) {
        blanksBreakdown = question.keywords.map((kw) => {
          const userItem = userAnswerRecord?.items.find(
            (item) => item.keywordId === kw.id,
          );
          return {
            keywordId: kw.id.toString(),
            blankOrder: kw.blankOrder,
            userAnswer: userItem ? userItem.answerText : null,
            correctAnswer: kw.correctAnswer,
            isCorrect: userItem ? userItem.isCorrect : false,
          };
        });
      }

      return {
        questionId: question.id.toString(),
        questionText: question.questionText,
        maxScore: question.maxScore,
        userAnswer: userAnswerRecord?.answerText ?? null,
        correctAnswer: question.answerText,
        isCorrect: userAnswerRecord?.isCorrect ?? false,
        ...(isBlankQuestion && { blanks: blanksBreakdown }),
      };
```

Replace with:
```typescript
      const userAnswerRecord = attempt.answers.find(
        (a) => a.quizQuestionId === question.id,
      );

      const isBlankQuestion = question.keywords.length > 0;
      let blanksBreakdown: any[] = [];
      let userAnswer: string | null = userAnswerRecord?.answerText ?? null;

      if (isBlankQuestion) {
        // Build blanks breakdown (unchanged)
        blanksBreakdown = question.keywords.map((kw) => {
          const userItem = userAnswerRecord?.items.find(
            (item) => item.keywordId === kw.id,
          );
          return {
            keywordId: kw.id.toString(),
            blankOrder: kw.blankOrder,
            userAnswer: userItem ? userItem.answerText : null,
            correctAnswer: kw.correctAnswer,
            isCorrect: userItem ? userItem.isCorrect : false,
          };
        });

        // Construct userAnswer by substituting user's blank answers into correctAnswer
        // Same pattern as getStudentQuestions() but uses user answers instead of [blank_N]
        if (userAnswerRecord?.items) {
          let result = "";
          let lastIndex = 0;
          const sortedKeywords = [...question.keywords].sort(
            (a, b) => a.startIndex - b.startIndex,
          );
          for (const kw of sortedKeywords) {
            const userItem = userAnswerRecord.items.find(
              (item) => item.keywordId === kw.id,
            );
            const userBlankAnswer = userItem ? userItem.answerText : "";
            result += question.answerText.slice(lastIndex, kw.startIndex);
            result += userBlankAnswer;
            lastIndex = kw.endIndex;
          }
          result += question.answerText.slice(lastIndex);
          userAnswer = result;
        }
      }

      return {
        questionId: question.id.toString(),
        questionText: question.questionText,
        maxScore: question.maxScore,
        userAnswer,
        correctAnswer: question.answerText,
        isCorrect: userAnswerRecord?.isCorrect ?? false,
        ...(isBlankQuestion && { blanks: blanksBreakdown }),
      };
```

**What this does:**
- For blank questions with user answers: takes `correctAnswer` (e.g. `"x = 5\ny = 3\nhasil = x + y\nprint(hasil)"`) and replaces each blank's span (startIndex..endIndex) with the user's submitted answer text
- For blank questions WITHOUT user answers: keeps `null` (avoiding an empty string showing as "answered")
- For non-blank questions: keeps the existing `userAnswerRecord?.answerText ?? null` behavior

---

### Task 2: Update the integration test

**Files:**
- Modify: `src/__tests__/student/quiz/blank-question.test.ts:286-298`

- [ ] **Step 1: Add assertion for constructed `userAnswer`**

The test at lines 286-298 submits:
- `keyword1` (blankOrder=1, correctAnswer="def", startIndex=30, endIndex=33) → user answered "def" (correct)
- `keyword2` (blankOrder=2, correctAnswer="function", startIndex=12, endIndex=20) → user answered "incorrectText" (wrong)

The constructed `userAnswer` should be:
- `answerText` = `"To define a function, use the def keyword."`
- After substituting blank 1 (startIndex=30, endIndex=33) with "def" (same as correct) and blank 2 (startIndex=12, endIndex=20) with "incorrectText":
  - `"To define a "` + `"incorrectText"` + `", use the "` + `"def"` + `" keyword."`
  - = `"To define a incorrectText, use the def keyword."`

Add assertions after the existing blanks checks at line 298:
```typescript
      // Verify constructed userAnswer
      expect(details.userAnswer).toBe(
        "To define a incorrectText, use the def keyword.",
      );
```

The full changed block (lines 286-299):
```typescript
      expect(resultsJson.data.score).toBe(50);

      const details = resultsJson.data.details[0];
      expect(details.isCorrect).toBe(false); // Overall answer is not fully correct
      expect(details.blanks).toHaveLength(2);
      expect(
        details.blanks.find((b: any) => b.keywordId === keyword1.id.toString())
          .isCorrect,
      ).toBe(true);
      expect(
        details.blanks.find((b: any) => b.keywordId === keyword2.id.toString())
          .isCorrect,
      ).toBe(false);
      expect(details.userAnswer).toBe(
        "To define a incorrectText, use the def keyword.",
      );
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
bun run test:setup
bun test src/__tests__/student/quiz/blank-question.test.ts
```

Expected output: All 4 tests PASS.

---

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files modified are committed together.

```bash
git add src/modules/student/quiz/service.ts src/__tests__/student/quiz/blank-question.test.ts
git commit -m "feat: construct userAnswer from correctAnswer with user's blank answers in results endpoint"
```
