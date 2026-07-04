# Pylearn — Lecturer Dashboard API Design

Scoped to the Lecturer Dashboard feature discussed (US-L3 + the additions: trends, content health, needs-attention list, most-missed blanks, unread material warnings, per-student status).

## Design principles

- **One endpoint per dashboard widget, not one giant endpoint.** The "at-a-glance" cards, the student table, and the blank-accuracy breakdown update on different cadences and get requested independently (e.g. table gets re-fetched on filter/sort/page change, stat cards don't) — bundling them into one response means over-fetching on every interaction.
- **Precompute what's expensive, compute-on-read what's cheap.** Trends and "most-missed blanks" involve aggregating over all historical attempts — precompute these on a schedule (e.g. hourly) and serve from a summary table. Simple counts (materials read, current pass rate) can be computed live from existing rows.
- **All endpoints scoped under a Group**, since dashboards are always viewed per-group, and authorization (lecturer owns this group) is checked once at that scope.
- **Read endpoints return derived status labels, not raw data the frontend has to interpret** (e.g. `"status": "stuck"` rather than making the frontend infer it from `attempts_count` and `days_since_activity`).

---

## Endpoints

### 1. Summary stats (top stat tiles)

```
GET /api/lecturer/groups/{groupId}/dashboard/summary
```

Response:

```json
{
  "group_id": "grp_123",
  "total_students": 24,
  "avg_materials_read": 5.2,
  "total_materials": 7,
  "avg_pass_rate": 0.74,
  "pass_rate_trend": {
    "current_week": 0.74,
    "previous_week": 0.68,
    "delta": 0.06
  },
  "generated_at": "2026-07-04T02:00:00Z"
}
```

- `generated_at` matters here since this is a precomputed snapshot — the frontend can show "as of X" if it's stale.

---

### 2. Content health (per-quiz pass rates — surfaces "this quiz might be broken")

```
GET /api/lecturer/groups/{groupId}/dashboard/content-health
```

Response:

```json
{
  "quizzes": [
    {
      "quiz_id": "qz_1",
      "level": 1,
      "title": "Level 1 — Variables",
      "first_attempt_pass_rate": 0.78,
      "avg_attempts_to_pass": 1.3
    },
    {
      "quiz_id": "qz_2",
      "level": 2,
      "title": "Level 2 — Loops",
      "first_attempt_pass_rate": 0.4,
      "avg_attempts_to_pass": 2.9,
      "flag": "low_pass_rate"
    },
    {
      "quiz_id": "qz_3",
      "level": 3,
      "title": "Level 3 — Functions",
      "first_attempt_pass_rate": 0.81,
      "avg_attempts_to_pass": 1.1
    }
  ],
  "materials": [
    {
      "material_id": "mat_4",
      "title": "Loop Edge Cases",
      "read_rate": 0.32,
      "flag": "low_read_rate"
    }
  ]
}
```

- `flag` is server-computed (e.g. `first_attempt_pass_rate < 0.5` → `low_pass_rate`; `read_rate` significantly below the group's average → `low_read_rate`). Keeps the "what needs attention" judgment in the backend, not scattered across frontend logic.

---

### 3. Most-missed blanks (drill-down per quiz)

```
GET /api/lecturer/quizzes/{quizId}/blank-stats
```

Response:

```json
{
  "quiz_id": "qz_2",
  "questions": [
    {
      "question_id": "q_10",
      "blanks": [
        { "blank_id": "b_101", "keyword": "iterate", "miss_rate": 0.61 },
        { "blank_id": "b_102", "keyword": "range", "miss_rate": 0.08 }
      ]
    }
  ]
}
```

- Sorted by `miss_rate` descending server-side so the frontend just renders top-to-bottom.

---

### 4. Needs-attention list (struggling/inactive students)

```
GET /api/lecturer/groups/{groupId}/dashboard/needs-attention
```

Response:

```json
{
  "students": [
    {
      "student_id": "stu_55",
      "name": "Alex Tan",
      "reason": "stuck",
      "detail": "Failed Level 2 quiz 4 times",
      "last_activity_days_ago": 1
    },
    {
      "student_id": "stu_77",
      "name": "Bea Wong",
      "reason": "inactive",
      "detail": "No activity in 9 days",
      "last_activity_days_ago": 9
    }
  ]
}
```

- `reason` enum: `stuck` (failed same level ≥ N times), `inactive` (no activity ≥ N days), `slow_progress` (below group's median pace) — thresholds configurable, but computed server-side so the frontend doesn't re-derive business rules.

---

### 5. Full student table (paginated, filterable, sortable)

```
GET /api/lecturer/groups/{groupId}/students
  ?status=stuck            (optional filter: on_track | stuck | inactive)
  &search=alex             (optional name search)
  &sort=last_activity       (materials_read | level1_score | level2_score | level3_score | last_activity)
  &order=desc
  &page=1
  &page_size=25
```

Response:

```json
{
  "page": 1,
  "page_size": 25,
  "total": 24,
  "students": [
    {
      "student_id": "stu_55",
      "name": "Alex Tan",
      "materials_read": 6,
      "materials_total": 7,
      "level_scores": [
        { "level": 1, "score": 0.9, "status": "passed" },
        { "level": 2, "score": 0.55, "status": "failed" },
        { "level": 3, "score": null, "status": "locked" }
      ],
      "last_activity_at": "2026-07-03T10:15:00Z",
      "status": "stuck"
    }
  ]
}
```

---

### 6. Per-student drill-down (expanded row detail)

```
GET /api/lecturer/groups/{groupId}/students/{studentId}/activity
```

Response:

```json
{
  "student_id": "stu_55",
  "materials": [
    {
      "material_id": "mat_1",
      "title": "Intro to Variables",
      "read_at": "2026-06-20T09:00:00Z"
    },
    { "material_id": "mat_2", "title": "Loop Basics", "read_at": null }
  ],
  "quiz_attempts": [
    {
      "quiz_id": "qz_2",
      "level": 2,
      "attempt_number": 4,
      "score": 0.55,
      "status": "failed",
      "submitted_at": "2026-07-02T14:00:00Z",
      "answers": [
        {
          "question_id": "q_10",
          "blank_results": [
            { "blank_id": "b_101", "correct": false },
            { "blank_id": "b_102", "correct": true }
          ]
        }
      ]
    }
  ]
}
```

---

### 7. Action: nudge a student

```
POST /api/lecturer/groups/{groupId}/students/{studentId}/nudge
```

Request body:

```json
{ "message": "Hey Alex, want to go over loops together this week?" }
```

Response: `201 Created`, sends a notification/email to the student. Keep this simple — a canned or free-text message, logged for the lecturer's own reference (`GET .../nudges` optional, not core).

---

### 8. Action: jump to edit a flagged question

No new endpoint — this is just a frontend deep link to the existing quiz-editing screen:

```
GET /api/lecturer/quizzes/{quizId}/questions/{questionId}
```

(Already exists as part of quiz management; the dashboard just needs to link to it using IDs it already has from endpoint #3.)

---

## Notes on implementation

- **Caching**: endpoints #1–#3 (summary, content-health, blank-stats) are good candidates for a short TTL cache (e.g. 5–15 min) or a scheduled precompute job, since they aggregate across all students/attempts and don't need to be real-time.
- **Endpoint #4 and #5** should stay closer to real-time (or short cache) since lecturers may act on them immediately (e.g. right after nudging someone, they might expect the list to reflect that soon).
- **Auth**: every endpoint should verify the requesting user is `role = lecturer` **and** owns (`created_by`) the `groupId` in the path — don't rely on frontend routing alone to enforce this.
- **Versioning**: prefix with `/api/v1/...` once you have a second version planned; not urgent for MVP.
