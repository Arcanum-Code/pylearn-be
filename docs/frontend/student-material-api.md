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

| Parameter | Type   | Description                                |
| --------- | ------ | ------------------------------------------ |
| `groupId` | string | The unique ID of the student group         |

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

| Parameter    | Type   | Description                    |
| ------------ | ------ | ------------------------------ |
| `materialId` | string | The unique ID of the material  |

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

| Parameter    | Type   | Description                    |
| ------------ | ------ | ------------------------------ |
| `materialId` | string | The unique ID of the material  |

### Request Body (`application/json`)

| Field               | Type   | Required | Description                                                    |
| ------------------- | ------ | -------- | -------------------------------------------------------------- |
| `status`            | string | Yes      | Must be one of: `in_progress`, `completed`                     |
| `scroll_percentage` | number | No       | The user's scroll percentage on the material (from `0` to `100`)|

### Response

```json
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
```
