# Pylearn — Student Material Viewing API (US-S1)

## Design principles

- **List and detail are separate endpoints.** The Group page needs a lightweight list (titles, order, read status) to render quickly; the material page needs full content + attachments. Combining them means shipping every material's full content just to render a list.
- **Progress is its own resource, updated via its own call** — the frontend doesn't need to resend material content just to mark it read.
- **"Read" detection is a client-side concern (scroll position / time-on-page), but the write is idempotent server-side** — re-marking something already `completed` should not error or create duplicates.

---

## Endpoints

### 1. List materials in a Group (Group page)

```
GET /api/student/groups/{groupId}/materials
```

Response:

```json
{
  "group_id": "grp_123",
  "group_name": "Python Basics",
  "materials": [
    {
      "material_id": "mat_1",
      "title": "Intro to Variables",
      "sequence_order": 1,
      "status": "completed",
      "completed_at": "2026-06-20T09:00:00Z"
    },
    {
      "material_id": "mat_2",
      "title": "Loop Basics",
      "sequence_order": 2,
      "status": "in_progress",
      "completed_at": null
    },
    {
      "material_id": "mat_3",
      "title": "Loop Edge Cases",
      "sequence_order": 3,
      "status": "not_started",
      "completed_at": null
    }
  ],
  "progress": { "completed": 1, "total": 7 }
}
```

- `status` comes from `MaterialProgress` (defaults to `not_started` if no row exists yet for this student).
- Sorted by `sequence_order` server-side — frontend just renders top to bottom.

---

### 2. View a single material

```
GET /api/student/materials/{materialId}
```

Response:

```json
{
  "material_id": "mat_2",
  "group_id": "grp_123",
  "title": "Loop Basics",
  "content": "<rich text / markdown content>",
  "attachment_url": "https://cdn.pylearn.app/materials/mat_2/handout.pdf",
  "sequence_order": 2,
  "status": "in_progress",
  "navigation": {
    "prev_material_id": "mat_1",
    "next_material_id": "mat_3"
  }
}
```

- `navigation` lets the frontend render "Previous / Next" without a second list call.
- On first `GET` of a material with no existing progress row, the backend can auto-create one with `status: "in_progress"` — this is what lets a lecturer later see "student opened this but didn't finish" rather than nothing at all.

---

### 3. Update reading progress

```
PATCH /api/student/materials/{materialId}/progress
```

Request body:

```json
{ "status": "completed" }
```

or, if you want finer-grained tracking (per assumption A3 — optional min-time/scroll requirement):

```json
{ "status": "in_progress", "scroll_percentage": 65 }
```

Response:

```json
{
  "material_id": "mat_2",
  "status": "completed",
  "completed_at": "2026-07-04T03:10:00Z"
}
```

- Idempotent: calling this again with `status: "completed"` on an already-completed material just returns the existing record unchanged (no duplicate rows, `completed_at` doesn't get overwritten).
- This is the call your frontend fires when its scroll-to-end (or time-on-page) logic decides the student has "read" the material — the business rule for what counts as "read" lives in the frontend trigger, but the persisted state lives here.

---

## Notes on implementation

- **Auth**: verify `role = student` on all three; per assumption A6 (open model), no group-membership check needed beyond being an authenticated student — revisit if you add enrollment later.
- **Ordering integrity**: `sequence_order` should be unique per group; if a lecturer reorders materials, `prev_material_id`/`next_material_id` in endpoint #2 should reflect the _current_ order at request time, not a cached one.
- **Why auto-create progress on first view (`in_progress`)**: this is what powers the lecturer's later "unread material warnings" widget — without it, you can't distinguish "never opened" from "opened but didn't finish," which matters for that dashboard feature.
- This progress data is exactly what feeds the quiz-gating check from earlier (`QuizMaterialLink` — all linked materials must have `status: completed`) and the lecturer dashboard's `materials_read` counts — no new derived logic needed beyond what's already in the data model.
