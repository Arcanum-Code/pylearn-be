# Material Management API Documentation

This document outlines the API endpoints available for managing learning materials. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## Base URL
All endpoints are relative to the `/materials` path.

---

## 1. Get All Materials

Retrieve a paginated list of materials. You can filter by lecturer, material type, and publish status.

**Endpoint:** `GET /materials/`
**Auth:** Bearer Token
**Permission Required:** `material_management` (`read`)

### Query Parameters

| Parameter      | Type    | Default | Description                                              |
| -------------- | ------- | ------- | -------------------------------------------------------- |
| `page`         | number  | `1`     | The page number to fetch                                 |
| `limit`        | number  | `10`    | Number of items per page                                 |
| `lecturerId`   | string  | -       | Optional filter by lecturer ID                           |
| `materialType` | string  | -       | Filter by type (`text`, `file`, `video`, `link`)         |
| `isPublished`  | boolean | -       | Filter by publish status (`true` or `false`)             |

### Response

```json
{
  "success": true,
  "message": "Materials retrieved successfully",
  "data": [
    {
      "id": "mat123xyz...",
      "lecturerId": "user123...",
      "groupId": "grp456...",
      "sequence": 1,
      "version": 1,
      "title": "Introduction to Python Variables",
      "description": "Learn about variable types and assignments.",
      "materialType": "text",
      "content": "<h1>Variables</h1><p>...</p>",
      "sourceUrl": null,
      "iconName": "book-open",
      "isPublished": true,
      "publishedAt": "2026-07-04T10:00:00.000Z",
      "createdAt": "2026-07-04T09:00:00.000Z",
      "updatedAt": "2026-07-04T09:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

## 2. Get Material Details

Retrieve detailed information for a specific material by its ID.

**Endpoint:** `GET /materials/:id`
**Auth:** Bearer Token
**Permission Required:** `material_management` (`read`)

### Path Parameters

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `id`      | string | The unique ID of the material  |

### Response

```json
{
  "success": true,
  "message": "Material retrieved successfully",
  "data": {
    "id": "mat123xyz...",
    "title": "Introduction to Python Variables",
    "materialType": "text"
    // ...other material fields
  }
}
```

---

## 3. Create a New Material (For Current Lecturer)

Create a new material assigned to the currently authenticated lecturer. **Use this endpoint instead of `POST /materials/` when the frontend is acting on behalf of the logged-in lecturer.**

**Endpoint:** `POST /materials/me`
**Auth:** Bearer Token
**Content-Type:** `multipart/form-data`
**Permission Required:** `material_management` (`create`)

### Request Body (`multipart/form-data`)

| Field          | Type    | Required | Description                                                    |
| -------------- | ------- | -------- | -------------------------------------------------------------- |
| `groupId`      | string  | Yes      | The ID of the student group this belongs to                    |
| `title`        | string  | Yes      | The title of the material (max 200 chars)                      |
| `materialType` | string  | Yes      | Must be one of: `text`, `file`, `video`, `link`                |
| `description`  | string  | No       | Material description (max 1000 chars)                          |
| `content`      | string  | No       | Text/HTML content (if type is `text`)                          |
| `sourceUrl`    | string  | No       | URL (if type is `link` or `video`)                             |
| `iconName`     | string  | No       | Icon identifier (max 50 chars)                                 |
| `isPublished`  | boolean | No       | Whether it should be published immediately (`true`/`false`)    |
| `sequence`     | number  | No       | Display order sequence                                         |
| `file`         | File    | No       | File upload (if type is `file`). **Only PDFs up to 10MB.**     |

### Response

```json
{
  "success": true,
  "message": "Material created successfully",
  "data": {
    "id": "mat456xyz...",
    "title": "Introduction to Python Variables",
    // ...created material fields
  }
}
```

---

## 4. Update a Material

Update an existing material. This endpoint supports updating text fields and/or replacing the uploaded file.

**Endpoint:** `PATCH /materials/:id`
**Auth:** Bearer Token
**Content-Type:** `multipart/form-data`
**Permission Required:** `material_management` (`update`)

### Path Parameters

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `id`      | string | The unique ID of the material  |

### Request Body (`multipart/form-data`)

*At least one field must be provided.*

| Field          | Type    | Required | Description                                                    |
| -------------- | ------- | -------- | -------------------------------------------------------------- |
| `title`        | string  | No       | The new title                                                  |
| `description`  | string  | No       | The new description                                            |
| `materialType` | string  | No       | One of: `text`, `file`, `video`, `link`                        |
| `content`      | string  | No       | New text/HTML content                                          |
| `sourceUrl`    | string  | No       | New URL                                                        |
| `iconName`     | string  | No       | New icon name                                                  |
| `isPublished`  | boolean | No       | Publish or unpublish                                           |
| `sequence`     | number  | No       | Update display order sequence                                  |
| `forceReread`  | boolean | No       | If `true`, resets student read progress for this material      |
| `file`         | File    | No       | Replace the file (if type is `file`). **Only PDFs up to 10MB.**|

### Response

```json
{
  "success": true,
  "message": "Material updated successfully",
  "data": {
    "id": "mat456xyz...",
    "title": "Updated Title",
    // ...updated material fields
  }
}
```

---

## 5. Delete a Material

Delete an existing material.

**Endpoint:** `DELETE /materials/:id`
**Auth:** Bearer Token
**Permission Required:** `material_management` (`delete`)

### Path Parameters

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `id`      | string | The unique ID of the material  |

### Response

```json
{
  "success": true,
  "message": "Material deleted successfully",
  "data": {
    "id": "mat456xyz..." // The ID of the deleted material
  }
}
```
