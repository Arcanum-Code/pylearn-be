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
| `materialType` | string  | -       | Filter by type (`file` - only PDFs are supported for MVP)  |
| `isPublished`  | boolean | -       | Filter by publish status (`true` or `false`). `true` returns materials where `publishedAt` is in the past. |

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
      "materialType": "file",
      "content": "/storage/materials/123456789-intro-to-python.pdf",
      "sourceUrl": null,
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
    "materialType": "file",
    "publishedAt": "2026-07-04T10:00:00.000Z"
    // ...other material fields
  }
}
```

---

## 3. Create a New Material (Admin/General)

Create a new material and specify the lecturer ID explicitly.

**Endpoint:** `POST /materials/`
**Auth:** Bearer Token
**Content-Type:** `multipart/form-data`
**Permission Required:** `material_management` (`create`)

### Request Body (`multipart/form-data`)

| Field          | Type    | Required | Description                                                    |
| -------------- | ------- | -------- | -------------------------------------------------------------- |
| `lecturerId`   | string  | Yes      | The ID of the lecturer creating this material                  |
| `groupId`      | string  | Yes      | The ID of the student group this belongs to                    |
| `title`        | string  | Yes      | The title of the material (max 200 chars)                      |
| `materialType` | string  | Yes      | Must be: `file`                                                |
| `description`  | string  | No       | Material description (max 1000 chars)                          |
| `content`      | string  | No       | Text/HTML content (Optional/unused for MVP)                    |
| `sourceUrl`    | string  | No       | URL (Optional/unused for MVP)                                  |
| `publishedAt`  | string  | No       | ISO Datetime string to schedule the material (`YYYY-MM-DDTHH:mm:ss.sssZ`). Leave blank for unpublished. |
| `sequence`     | number  | No       | Display order sequence                                         |
| `file`         | File    | Yes      | File upload. **Only PDFs up to 10MB are permitted.**           |

### Response

```json
{
  "success": true,
  "message": "Material created successfully",
  "data": {
    "id": "mat456xyz...",
    "title": "Introduction to Python Variables"
    // ...created material fields
  }
}
```

---

## 4. Create a New Material (For Current Lecturer)

Create a new material assigned to the currently authenticated lecturer.

**Endpoint:** `POST /materials/me`
**Auth:** Bearer Token
**Content-Type:** `multipart/form-data`
**Permission Required:** `material_management` (`create`)

### Request Body (`multipart/form-data`)

| Field          | Type    | Required | Description                                                    |
| -------------- | ------- | -------- | -------------------------------------------------------------- |
| `groupId`      | string  | Yes      | The ID of the student group this belongs to                    |
| `title`        | string  | Yes      | The title of the material (max 200 chars)                      |
| `materialType` | string  | Yes      | Must be: `file`                                                |
| `description`  | string  | No       | Material description (max 1000 chars)                          |
| `content`      | string  | No       | Text/HTML content (Optional/unused for MVP)                    |
| `sourceUrl`    | string  | No       | URL (Optional/unused for MVP)                                  |
| `publishedAt`  | string  | No       | ISO Datetime string to schedule the material (`YYYY-MM-DDTHH:mm:ss.sssZ`). Leave blank for unpublished. |
| `sequence`     | number  | No       | Display order sequence                                         |
| `file`         | File    | Yes      | File upload. **Only PDFs up to 10MB are permitted.**           |

### Response

```json
{
  "success": true,
  "message": "Material created successfully",
  "data": {
    "id": "mat456xyz...",
    "title": "Introduction to Python Variables"
    // ...created material fields
  }
}
```

---

## 5. Update a Material

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
| `materialType` | string  | No       | Must be: `file`                                                |
| `content`      | string  | No       | New text/HTML content (Optional/unused for MVP)                |
| `sourceUrl`    | string  | No       | New URL (Optional/unused for MVP)                              |
| `publishedAt`  | string  | No       | ISO Datetime string to schedule the material. Set to empty or don't pass to unpublish. |
| `sequence`     | number  | No       | Update display order sequence                                  |
| `forceReread`  | boolean | No       | If `true`, resets student read progress for this material      |
| `file`         | File    | No       | Replace the file. **Only PDFs up to 10MB are permitted.**      |

### Response

```json
{
  "success": true,
  "message": "Material updated successfully",
  "data": {
    "id": "mat456xyz...",
    "title": "Updated Title"
    // ...updated material fields
  }
}
```

---

## 6. Publish a Material Now

Instantly publishes a material by setting its `publishedAt` to the current UTC time.

**Endpoint:** `POST /materials/:id/publish`
**Auth:** Bearer Token
**Permission Required:** `material_management` (`update`)

### Path Parameters

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `id`      | string | The unique ID of the material  |

### Response

```json
{
  "success": true,
  "message": "Material updated successfully",
  "data": {
    "id": "mat456xyz...",
    "publishedAt": "2026-07-06T18:00:00.000Z"
  }
}
```

---

## 7. Delete a Material

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
    "id": "mat456xyz..."
  }
}
```
