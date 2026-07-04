# Pylearn — Lecturer Quiz Creation API (US-L2)

## Design principles

- **Quiz creation is multi-step (metadata → questions → blanks → materials/threshold → publish), so it's modeled as a draft that gets built up across several calls, not one giant "create everything at once" payload.** A lecturer writing a key answer and selecting blanks is an iterative UI action — forcing it into a single atomic request would make partial saves and validation errors much harder to handle.
- **Blanks are a sub-resource of a question**, since they're defined by selecting spans of the question's own key-answer text — they don't make sense independent of a question.
- **Publishing is a distinct action, not a side effect of saving.** A quiz can sit in `draft` status while the lecturer is still adding questions; validation (≥1 blank per question, level uniqueness, materials linked) only needs to run once, at publish time — not on every keystroke-adjacent save.

---

## Endpoints

### 1. Create a quiz (metadata only)

```
POST /api/lecturer/groups/{groupId}/quizzes
```

Request body:

```json
{
  "level": 2,
  "title": "Level 2 — Loops",
  "pass_threshold": 70
}
```

Response: `201 Created`

```json
{
  "quiz_id": "qz_2",
  "group_id": "grp_123",
  "level": 2,
  "title": "Level 2 — Loops",
  "pass_threshold": 70,
  "status": "draft",
  "questions": []
}
```

- `422 Unprocessable Entity` if `level` already exists in this group (unique-per-group constraint) — return existing quiz's id/title in the error so the lecturer can be pointed to it rather than just told "level taken."
- **No material selection here.** The reading gate is no longer a per-quiz choice — it's simply "every material in this quiz's `group_id`," so there's nothing for the lecturer to pick. This also means Level 1 requires the same full-group reading as Level 3 — only the _pass-level_ gate differs between levels, not the _reading_ gate. Worth confirming this is really the intent: a student can't touch even Level 1 until all 7 materials in the group are read.

---

### 2. Update quiz metadata

```
PATCH /api/lecturer/quizzes/{quizId}
```

Request body (any subset):

```json
{ "title": "Level 2 — Loops & Iteration", "pass_threshold": 75 }
```

Response: `200 OK`, full updated quiz object (same shape as #1).

- Same `422` level-conflict check applies if `level` is included in the update.
- Per assumption A7: if this quiz already has attempts, allow the edit but include a `"warning": "This quiz has 12 existing attempts; past scores will not be recalculated."` field in the response so the frontend can surface it.

---

### 3. Add a question to a quiz

```
POST /api/lecturer/quizzes/{quizId}/questions
```

Request body:

```json
{
  "question_text": "Explain how a for-loop iterates over a list in Python.",
  "key_answer_text": "A for-loop uses range or iterate directly over each item in the list until it reaches the end.",
  "sequence_order": 1
}
```

Response: `201 Created`

```json
{
  "question_id": "q_10",
  "quiz_id": "qz_2",
  "question_text": "Explain how a for-loop iterates over a list in Python.",
  "key_answer_text": "A for-loop uses range or iterate directly over each item in the list until it reaches the end.",
  "sequence_order": 1,
  "blanks": []
}
```

- Note: a question with zero blanks is a valid _intermediate_ state (lecturer hasn't selected words yet) — this is allowed here and only blocked at publish time (#6).

---

### 4. Define blanks for a question

Since blanks are chosen by selecting spans of the key answer, this replaces the full blank set each time (simpler for the frontend than diffing individual add/remove calls as the lecturer clicks around):

```
PUT /api/lecturer/questions/{questionId}/blanks
```

Request body:

```json
{
  "blanks": [
    { "keyword": "range", "start_index": 14, "end_index": 19 },
    { "keyword": "iterate", "start_index": 23, "end_index": 30 }
  ]
}
```

Response: `200 OK`

```json
{
  "question_id": "q_10",
  "blanks": [
    {
      "blank_id": "b_101",
      "keyword": "range",
      "start_index": 14,
      "end_index": 19
    },
    {
      "blank_id": "b_102",
      "keyword": "iterate",
      "start_index": 23,
      "end_index": 30
    }
  ]
}
```

- `start_index`/`end_index` should be validated server-side against the current `key_answer_text` to make sure they actually point at the claimed `keyword` (protects against stale frontend state after a key-answer edit).
- If `key_answer_text` is edited later (#5 below) in a way that shifts text positions, existing blanks referencing now-mismatched indices should be flagged (`"blanks_invalidated": true` in the edit response) rather than silently left wrong.

---

### 5. Edit a question's text/key answer

```
PATCH /api/lecturer/questions/{questionId}
```

Request body:

```json
{ "question_text": "...", "key_answer_text": "..." }
```

Response: `200 OK`, same shape as #3, plus (if applicable):

```json
{
  "blanks_invalidated": true,
  "message": "Key answer changed; please re-select blanks."
}
```

---

### 6. Delete a question

```
DELETE /api/lecturer/questions/{questionId}
```

Response: `204 No Content`. Cascades to delete its blanks.

---

### 7. Publish the quiz

```
POST /api/lecturer/quizzes/{quizId}/publish
```

Response on success: `200 OK`

```json
{ "quiz_id": "qz_2", "status": "published" }
```

Response on validation failure: `422 Unprocessable Entity`

```json
{
  "status": "draft",
  "errors": [
    {
      "code": "question_missing_blanks",
      "question_id": "q_11",
      "message": "This question has no blanks defined."
    },
    {
      "code": "no_materials_in_group",
      "message": "This group has no published materials yet, so this quiz cannot be gated."
    }
  ]
}
```

- This is where the rules from the user story get enforced at once: level uniqueness (already checked on create/update) and every question has ≥1 blank. `no_materials_in_group` is a guardrail, not a per-quiz choice — it only fires if the group itself has zero materials at all (nothing for the reading-gate to check against), which would make the quiz un-gateable. Keeping validation centralized here — rather than scattered across #1–#5 — means the lecturer can save partial, messy drafts freely and only has to clean things up right before going live.

---

### 8. List quizzes in a group (quiz management screen)

```
GET /api/lecturer/groups/{groupId}/quizzes
```

Response:

```json
{
  "quizzes": [
    {
      "quiz_id": "qz_1",
      "level": 1,
      "title": "Level 1 — Variables",
      "status": "published",
      "question_count": 4
    },
    {
      "quiz_id": "qz_2",
      "level": 2,
      "title": "Level 2 — Loops",
      "status": "draft",
      "question_count": 2
    }
  ]
}
```

### 9. Get full quiz detail (for editing)

```
GET /api/lecturer/quizzes/{quizId}
```

Response: full quiz object with nested `questions[]`, each with nested `blanks[]`, plus `pass_threshold` — the complete state needed to render the quiz-builder screen in one call. If you want the lecturer to see _which_ materials will gate this quiz (for their own visibility, even though it's no longer configurable), include a read-only `gating_materials: [...]` array pulled from the group, not something they submit back.

### 10. Delete a quiz

```
DELETE /api/lecturer/quizzes/{quizId}
```

- `409 Conflict` if the quiz is `published` **and** has existing student attempts — don't allow silent deletion of graded history. Require the lecturer to archive instead (or explicitly confirm cascading delete) rather than exposing a hard delete on live data.

---

## Notes on implementation

- **This changes the data model from the earlier requirements doc.** The `QuizMaterialLink` many-to-many table is no longer needed — the "must read first" check becomes: _all materials where `material.group_id == quiz.group_id` have `MaterialProgress.status == completed` for this student._ One less table, one less thing for the lecturer to configure, and one less thing that can drift out of sync (e.g. a lecturer adding a new material but forgetting to link it to existing quizzes — with this model, new materials automatically become part of every quiz's gate in that group). I'd recommend updating Section 3 of the requirements doc to drop `QuizMaterialLink` and simplify the derived-logic note in 3.3 accordingly, if you're happy with this direction.
- **Why PUT (replace) for blanks instead of individual POST/DELETE per blank**: the lecturer's interaction is "select these words" as one mental action per editing session, and re-sending the full set avoids a class of bugs where the frontend's local blank list and the server's drift out of sync after several rapid clicks.
- **Auth**: every endpoint checks `role = lecturer` and `created_by = current_user` on the parent quiz/group — a lecturer should not be able to edit another lecturer's quiz via a guessed ID.
- **Draft vs. published matters for students too**: student-facing endpoints (from earlier docs) should only ever return quizzes where `status = published` — worth double-checking that filter is applied wherever students list/fetch quizzes.
