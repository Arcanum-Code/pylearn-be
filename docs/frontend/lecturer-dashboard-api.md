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

**Endpoint:** `GET /api/lecturer/groups/:groupId/dashboard/summary`
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

**Endpoint:** `GET /api/lecturer/groups/:groupId/dashboard/content-health`
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
