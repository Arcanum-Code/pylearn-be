# Group Management API Documentation

This document outlines the API endpoints available for managing student groups. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## Base URL

All endpoints are relative to the `/groups` path.

---

## 1. Get All Groups

Retrieve a list of all groups that the authenticated lecturer has access to.

**Endpoint:** `GET /groups/`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`read`)

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "grp123xyz...",
      "name": "Introduction to Computer Science - Section A",
      "description": "Fall 2026 cohort for beginners",
      "createdAt": "2026-07-04T10:00:00.000Z",
      "updatedAt": "2026-07-04T10:00:00.000Z"
    }
  ]
}
```

---

## 2. Get Group Details

Retrieve detailed information for a specific group, including the materials and quizzes assigned to it.

**Endpoint:** `GET /groups/:id`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`read`)

### Path Parameters

| Parameter | Type   | Description                |
| --------- | ------ | -------------------------- |
| `id`      | string | The unique ID of the group |

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "grp123xyz...",
    "name": "Introduction to Computer Science - Section A",
    "description": "Fall 2026 cohort for beginners",
    "createdAt": "2026-07-04T10:00:00.000Z",
    "updatedAt": "2026-07-04T10:00:00.000Z",
    "materials": [
      {
        "id": "mat123xyz...",
        "title": "Variables and Data Types",
        "isPublished": true
      }
    ],
    "quizzes": [
      {
        "id": "quiz123xyz...",
        "title": "Variable Scope Quiz",
        "levelNumber": 1,
        "isPublished": true
      }
    ]
  }
}
```

---

## 3. Create a New Group

Create a new group.

**Endpoint:** `POST /groups/`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`create`)

### Request Body (JSON)

| Field         | Type   | Required | Description                             |
| ------------- | ------ | -------- | --------------------------------------- |
| `name`        | string | Yes      | The name of the group (min 1 character) |
| `description` | string | No       | An optional description for the group   |

**Example:**

```json
{
  "name": "Data Structures - Section B",
  "description": "Advanced programming group"
}
```

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "grp456xyz...",
    "name": "Data Structures - Section B",
    "description": "Advanced programming group",
    "createdAt": "2026-07-05T10:00:00.000Z",
    "updatedAt": "2026-07-05T10:00:00.000Z"
  }
}
```

---

## 4. Update a Group

Update an existing group's details.

**Endpoint:** `PATCH /groups/:id`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`update`)

### Path Parameters

| Parameter | Type   | Description                |
| --------- | ------ | -------------------------- |
| `id`      | string | The unique ID of the group |

### Request Body (JSON)

| Field         | Type   | Required | Description                                |
| ------------- | ------ | -------- | ------------------------------------------ |
| `name`        | string | No       | The new name of the group                  |
| `description` | string | No       | The new description (can be set to `null`) |

**Example:**

```json
{
  "description": "Updated description for the advanced group"
}
```

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "grp456xyz...",
    "name": "Data Structures - Section B",
    "description": "Updated description for the advanced group",
    "createdAt": "2026-07-05T10:00:00.000Z",
    "updatedAt": "2026-07-05T10:15:00.000Z"
  }
}
```

---

## 5. Delete a Group

Delete an existing group.

**Endpoint:** `DELETE /groups/:id`
**Auth:** Bearer Token
**Permission Required:** `group_management` (`delete`)

### Path Parameters

| Parameter | Type   | Description                |
| --------- | ------ | -------------------------- |
| `id`      | string | The unique ID of the group |

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "success": true
  }
}
```

## Note on Standardized Responses

All responses adhere to the standard `createResponseSchema` format. The requested data (or boolean success status for deletions) is always nested under the `data` field, accompanied by boolean `success` and string `message` fields.
