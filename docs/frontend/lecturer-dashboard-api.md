# Lecturer Dashboard API Documentation (Implemented)

This document outlines the endpoints currently available for the frontend to build the Lecturer Dashboard. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## 1. General Lecturer Overview

This endpoint provides a global overview of the lecturer's content (materials and quizzes) and general engagement across all their groups/students.

**Endpoint:** `GET /dashboard/dosen`
**Auth:** Bearer Token (Requires authenticated user)

### Response

```json
{
  "success": true,
  "message": "Dashboard retrieved successfully",
  "data": {
    "overview": {
      "totalMaterials": 10,
      "totalQuizzes": 5,
      "totalStudentAttempts": 150
    },
    "groupsOverview": [
      {
        "groupId": "grp123xyz...",
        "groupName": "Introduction to Computer Science - Section A",
        "totalStudents": 45,
        "avgPassRate": 82.5,
        "totalStudentAttempts": 120
      }
    ],
    "materialBreakdown": [
      {
        "materialId": "cm123xyz...",
        "title": "Introduction to Python Variables",
        "materialType": "RICH_TEXT",
        "quizCount": 2,
        "levelCount": 1,
        "uniqueStudentsEngaged": 45
      }
    ]
  }
}
```

---

## 2. Group-Specific Dashboard: Summary

This endpoint fetches high-level metrics and trends for a specific student group.

**Endpoint:** `GET /lecturer/groups/:groupId/dashboard/summary`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`read`)

### Path Parameters

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `groupId` | string | The unique ID of the student group |

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "group_id": "grp123...",
    "total_students": 45,
    "avg_materials_read": 8.5,
    "total_materials": 10,
    "avg_pass_rate": 82.5,
    "pass_rate_trend": {
      "current_week": 85.0,
      "previous_week": 80.0,
      "delta": 5.0
    },
    "generated_at": "2024-03-24T10:00:00.000Z"
  }
}
```

---

## 3. Group-Specific Dashboard: Content Health

This endpoint provides actionable analytics on how the group is performing on specific quizzes and reading materials. It highlights problematic content (e.g., low pass rates, high attempts to pass) using flags.

**Endpoint:** `GET /lecturer/groups/:groupId/dashboard/content-health`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`read`)

### Path Parameters

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `groupId` | string | The unique ID of the student group |

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "quizzes": [
      {
        "quiz_id": "quiz123...",
        "level": 1,
        "title": "Variable Scope Quiz",
        "first_attempt_pass_rate": 45.5,
        "avg_attempts_to_pass": 3.2,
        "flag": "high_failure_rate" 
      }
    ],
    "materials": [
      {
        "material_id": "mat123...",
        "title": "Understanding Python Functions",
        "read_rate": 95.0,
        "flag": null
      }
    ]
  }
}
```

## Note on Standardized Responses

All responses adhere to the standard `createResponseSchema` format. The actual dashboard content is always nested under the `data` field, accompanied by boolean `success` and string `message` fields.

---

## 4. Calendar Events (Agenda Kelas)

This endpoint fetches all scheduled events (quiz openings/closings and material releases) for a given month and year.

**Endpoint:** `GET /lecturer/calendar/events`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`read`)

### Query Parameters

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `year`    | number | Yes      | The 4-digit year (e.g., `2026`) |
| `month`   | number | Yes      | The 1-indexed month (e.g., `7` for July) |
| `groupId` | string | No       | If provided, filters events to only include those relevant to a specific class |

### Response

```json
{
  "success": true,
  "message": "Calendar events fetched successfully",
  "data": [
    {
      "id": "evt-123",
      "date": "2026-07-06",
      "time": "23:59",
      "type": "quiz_close",
      "title": "Kuis Python Dasar 1 ditutup",
      "targetId": "quiz-abc",
      "groupId": "group-xyz"
    },
    {
      "id": "evt-124",
      "date": "2026-07-08",
      "time": "08:00",
      "type": "material_release",
      "title": "Materi Pengenalan Fungsi rilis",
      "targetId": "mat-def",
      "groupId": "group-xyz"
    }
  ]
}
```

---

## 5. Recent Activity (Aktivitas Terkini)

This endpoint provides a real-time feed of recent student quiz submissions (auto-graded).

**Endpoint:** `GET /lecturer/dashboard/recent-activity`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`read`)

### Query Parameters

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `limit`   | number | No       | The maximum number of recent activities to return (default: 10) |
| `groupId` | string | No       | If provided, filters activity to a specific class |

### Response

```json
{
  "success": true,
  "message": "Recent activity fetched successfully",
  "data": [
    {
      "id": "attempt-789",
      "studentName": "Budi Santoso",
      "taskName": "Kuis 2: Control Flow",
      "submittedAt": "2026-07-06T12:45:00Z",
      "score": 95,
      "groupId": "group-xyz"
    },
    {
      "id": "attempt-790",
      "studentName": "Andi Wijaya",
      "taskName": "Kuis 2: Control Flow",
      "submittedAt": "2026-07-06T09:30:00Z",
      "score": 65,
      "groupId": "group-xyz"
    }
  ]
}
```

---

## 6. Schema Changes (Backend Requirements)

To support the scheduled materials and quiz periods, the following fields should be added to the database schema.

**Material Schema:**
```prisma
model Material {
  // ... existing fields
  publishAt  DateTime?  // Scheduled publishing timestamp. If null, active immediately.
}
```

**Quiz Schema:**
```prisma
model Quiz {
  // ... existing fields
  openAt     DateTime?  // When students can start attempting the quiz
  closeAt    DateTime?  // The deadline for completing the quiz
}
```
