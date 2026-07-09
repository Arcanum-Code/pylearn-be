# Student Material API Documentation

This document outlines the API endpoints available for students to access and interact with learning materials. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## Base URL

All endpoints are relative to the root API path.

---

## 1. Get Group Materials

Retrieve a list of materials for a specific student group, along with the student's progress.

**Endpoint:** `GET /groups/:groupId/materials`
**Auth:** Bearer Token
**Permission Required:** `student_material_access` (`read`)

### Path Parameters

| Parameter | Type   | Description                        |
| --------- | ------ | ---------------------------------- |
| `groupId` | string | The unique ID of the student group |

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "group_id": "grp123...",
    "group_name": "Python Basics Cohort 1",
    "materials": [
      {
        "material_id": "1",
        "title": "Introduction to Python",
        "sequence_order": 1,
        "status": "completed",
        "completed_at": "2026-07-04T10:00:00.000Z"
      },
      {
        "material_id": "2",
        "title": "Variables and Data Types",
        "sequence_order": 2,
        "status": "not_started",
        "completed_at": null
      }
    ],
    "quizzes": [
      {
        "quiz_id": "101",
        "title": "Quiz Level 1: Python Syntax",
        "level_number": 1,
        "status": "completed",
        "pass_threshold": 70.0,
        "is_passed": true,
        "best_score": 85.0,
        "deadline": "2026-07-20T23:59:59.000Z"
      },
      {
        "quiz_id": "102",
        "title": "Quiz Level 2: Variables",
        "level_number": 2,
        "status": "not_started",
        "pass_threshold": 75.0,
        "is_passed": null,
        "best_score": null,
        "deadline": null
      }
    ],
    "progress": {
      "completed": 1,
      "total": 2
    }
  }
}
```

---

## 2. Get Material Details

Retrieve detailed information and content for a specific material. Accessing this endpoint automatically initiates the read progress (sets status to `in_progress` if not started). It also returns navigation information for the previous and next materials in the group.

**Endpoint:** `GET /materials/:materialId`
**Auth:** Bearer Token
**Permission Required:** `student_material_access` (`read`)

### Path Parameters

| Parameter    | Type   | Description                   |
| ------------ | ------ | ----------------------------- |
| `materialId` | string | The unique ID of the material |

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "material_id": "1",
    "group_id": "grp123...",
    "title": "Introduction to Python",
    "content": "<h1>Welcome to Python</h1><p>...</p>",
    "attachment_url": "https://example.com/attachment.pdf",
    "sequence_order": 1,
    "status": "in_progress",
    "scroll_percentage": 50,
    "navigation": {
      "prev_material_id": null,
      "next_material_id": "2"
    }
  }
}
```

---

## 3. Update Material Progress

Update the student's progress for a specific material, such as marking it as completed or updating the scroll percentage.

**Endpoint:** `PATCH /materials/:materialId/progress`
**Auth:** Bearer Token
**Content-Type:** `application/json`
**Permission Required:** `student_material_access` (`update`)

### Path Parameters

| Parameter    | Type   | Description                   |
| ------------ | ------ | ----------------------------- |
| `materialId` | string | The unique ID of the material |

### Request Body (`application/json`)

| Field               | Type   | Required | Description                                                      |
| ------------------- | ------ | -------- | ---------------------------------------------------------------- |
| `status`            | string | Yes      | Must be one of: `in_progress`, `completed`                       |
| `scroll_percentage` | number | No       | The user's scroll percentage on the material (from `0` to `100`) |

### Response

````json
{
  "success": true,
  "message": "Success",
  "data": {
    "material_id": "1",
    "status": "completed",
    "scroll_percentage": 100,
    "completed_at": "2026-07-05T15:00:00.000Z"
  }
}

---

## 4. Get Student Group Detail Timeline (MVP)

Retrieve a unified chronological timeline (`items`) of both materials and quizzes for a group, formatted specifically for the student course portal.

**Endpoint:** `GET /groups/mahasiswa/:groupId`
**Auth:** Bearer Token
**Permission Required:** `student_material_access` (`read`)

### Path Parameters

| Parameter | Type   | Description                                |
| --------- | ------ | ------------------------------------------ |
| `groupId` | string | The unique ID of the student group         |

### Response

```json
{
  "success": true,
  "message": "Detail kelas berhasil diambil",
  "data": {
    "groupId": "grp_abc123",
    "groupName": "Introduction to Python 101",
    "description": "Kelas ini membahas dasar-dasar pemrograman Python mulai dari variabel hingga object-oriented programming.",
    "lecturerName": "Dr. Alan Turing",
    "progress": {
      "materialsCompleted": 2,
      "materialsTotal": 5,
      "percentage": 40
    },
    "items": [
      {
        "type": "material",
        "id": "mat_1",
        "title": "Welcome to Python",
        "description": "Pengenalan sejarah dan sintaks dasar Python.",
        "status": "completed",
        "scrollPercentage": 100,
        "order": 1
      },
      {
        "type": "material",
        "id": "mat_2",
        "title": "Variables and Data Types",
        "description": "Memahami string, integer, float, dan boolean.",
        "status": "in_progress",
        "scrollPercentage": 45,
        "order": 2
      },
      {
        "type": "quiz",
        "id": "quiz_1",
        "title": "Kuis Dasar Python",
        "description": "Uji pemahaman Anda tentang variabel dan tipe data.",
        "status": "not_started",
        "deadline": "2026-07-20T23:59:59.000Z",
        "bestScore": null,
        "passThreshold": 70,
        "isPassed": null,
        "order": 3
      }
    ]
  }
}
````

- **Unified Timeline**: Merges published materials (using `sequence`) and published quizzes (using `levelNumber`) into a single chronological timeline sorted by `order`.
- **Hides Drafts**: Materials and quizzes that are not published are completely excluded.
- **Student Progress**: Calculates the completion percentage of materials within the group.

```

```
