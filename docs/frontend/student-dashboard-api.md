# Student Dashboard API Documentation

This document outlines the API endpoint available for retrieving the student dashboard data. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## Base URL
All endpoints are relative to the `/dashboard` path.

---

## 1. Get Student Dashboard

Retrieve the student's dashboard metrics, including an overview of their quiz attempts, their in-progress quizzes, and their most recent quiz results. This data is scoped to the currently authenticated student.

**Endpoint:** `GET /dashboard/mahasiswa`
**Auth:** Bearer Token
**Permission Required:** Implicit (available to authenticated students)

### Request Parameters

This endpoint takes no query or path parameters. The dashboard is automatically resolved for the logged-in student user based on their authentication token.

### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "overview": {
      "totalAttempts": 15,
      "quizzesCompleted": 12
    },
    "inProgress": [
      {
        "attemptId": "25",
        "quizId": "4",
        "quizTitle": "Python Functions Quiz",
        "startedAt": "2026-07-05T10:30:00.000Z"
      }
    ],
    "recentResults": [
      {
        "attemptId": "24",
        "quizId": "3",
        "quizTitle": "Loops and Iterations Quiz",
        "submittedAt": "2026-07-04T14:45:00.000Z"
      },
      {
        "attemptId": "23",
        "quizId": "2",
        "quizTitle": "Variables and Types Quiz",
        "submittedAt": "2026-07-03T09:15:00.000Z"
      }
    ],
    "enrolledGroups": [
      {
        "groupId": "grp_abc123",
        "groupName": "Introduction to Python 101",
        "materialsCompleted": 2,
        "materialsTotal": 5,
        "materials": [
          {
            "materialId": "mat_1",
            "title": "Welcome to Python",
            "status": "completed",
            "scrollPercentage": 100
          },
          {
            "materialId": "mat_2",
            "title": "Variables and Data Types",
            "status": "in_progress",
            "scrollPercentage": 45
          },
          {
            "materialId": "mat_3",
            "title": "Control Flow",
            "status": "not_started",
            "scrollPercentage": null
          }
        ]
      }
    ]
  }
}
```

### Field Descriptions

- **overview**: High-level metrics for the student.
  - `totalAttempts`: Total number of quiz attempts the student has initiated.
  - `quizzesCompleted`: Total number of quiz attempts the student has successfully submitted.
- **inProgress**: A list of quiz attempts that the student has started but not yet submitted.
  - `attemptId`: The unique ID of the quiz attempt.
  - `quizId`: The ID of the associated quiz.
  - `quizTitle`: The title of the quiz.
  - `startedAt`: The timestamp when the attempt began.
- **recentResults**: A list of the student's most recently submitted quiz attempts (limited to 5).
  - `attemptId`: The unique ID of the quiz attempt.
  - `quizId`: The ID of the associated quiz.
  - `quizTitle`: The title of the quiz.
  - `submittedAt`: The timestamp when the attempt was submitted.
- **enrolledGroups**: A list of groups/classes the student is currently enrolled in, along with their progress on the materials.
  - `groupId`: The unique ID of the group.
  - `groupName`: The name of the group/class.
  - `materialsCompleted`: The number of materials the student has completed reading in this group.
  - `materialsTotal`: The total number of materials assigned to this group.
  - `materials`: Detailed list of materials for this group.
    - `materialId`: The ID of the material.
    - `title`: The title of the material.
    - `status`: The reading status (`not_started`, `in_progress`, or `completed`).
    - `scrollPercentage`: The student's scroll percentage (0-100) or `null` if not started.
