# Student Quiz API Documentation

This document outlines the API endpoints available for students to attempt quizzes, submit answers, track progress, and view quiz results. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## Base URL
All endpoints are relative to the root API path and are prefixed with `/student/quizzes`.

---

## Part 1: Quiz Attempt Management

### 1. List Quiz Attempts
Retrieve a list of quiz attempts made by the authenticated student. Optionally filter by a specific quiz ID.

**Endpoint:** `GET /student/quizzes/attempts`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Query Parameters

| Parameter | Type   | Required | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `quizId`  | string | No       | Filter attempts by a specific quiz ID            |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "att_123456",
      "quizId": "quiz_789012",
      "quizTitle": "Python Variables and Types",
      "studentId": "usr_345678",
      "studentName": "John Doe",
      "startedAt": "2026-07-07T10:00:00.000Z",
      "submittedAt": null,
      "createdAt": "2026-07-07T10:00:00.000Z",
      "updatedAt": "2026-07-07T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Get Quiz Attempt Details
Retrieve detailed information about a specific quiz attempt by its ID.

**Endpoint:** `GET /student/quizzes/attempts/:id`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Path Parameters

| Parameter | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `id`      | string | The unique ID of the quiz attempt   |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "att_123456",
    "quizId": "quiz_789012",
    "quizTitle": "Python Variables and Types",
    "studentId": "usr_345678",
    "studentName": "John Doe",
    "startedAt": "2026-07-07T10:00:00.000Z",
    "submittedAt": null,
    "createdAt": "2026-07-07T10:00:00.000Z",
    "updatedAt": "2026-07-07T10:00:00.000Z"
  }
}
```

---

### 3. Create Quiz Attempt
Start a new attempt for a quiz. Students must start an attempt before they can view questions or submit answers.

**Endpoint:** `POST /student/quizzes/attempts`  
**Auth:** Bearer Token  
**Content-Type:** `application/json`  
**Permission Required:** `student_quiz_access` (`create`)

#### Request Body (`application/json`)

| Field    | Type   | Required | Description                     |
| -------- | ------ | -------- | ------------------------------- |
| `quizId` | string | Yes      | The ID of the quiz to attempt   |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "att_123456",
    "quizId": "quiz_789012",
    "quizTitle": "Python Variables and Types",
    "studentId": "usr_345678",
    "studentName": "John Doe",
    "startedAt": "2026-07-07T10:00:00.000Z",
    "submittedAt": null,
    "createdAt": "2026-07-07T10:00:00.000Z",
    "updatedAt": "2026-07-07T10:00:00.000Z"
  }
}
```

---

### 4. Submit Quiz Attempt
Finalize and submit an ongoing quiz attempt. Once submitted, answers can no longer be modified, and grading is completed. For questions with blanks, score is calculated as average points (e.g., getting 2 of 3 blanks correct gives 66.66% of that question's max score).

**Endpoint:** `PATCH /student/quizzes/attempts/:id/submit`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`update`)

#### Path Parameters

| Parameter | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `id`      | string | The unique ID of the quiz attempt   |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "att_123456",
    "quizId": "quiz_789012",
    "quizTitle": "Python Variables and Types",
    "studentId": "usr_345678",
    "studentName": "John Doe",
    "startedAt": "2026-07-07T10:00:00.000Z",
    "submittedAt": "2026-07-07T10:15:00.000Z",
    "createdAt": "2026-07-07T10:00:00.000Z",
    "updatedAt": "2026-07-07T10:15:00.000Z"
  }
}
```

---

### 5. Get Student Quiz Progress
Retrieve the current status and progress of the student for a specific quiz, including ongoing attempt ID and attempt history.

**Endpoint:** `GET /student/quizzes/attempts/status/me`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Query Parameters

| Parameter | Type   | Required | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `quizId`  | string | Yes      | The ID of the quiz to check progress for         |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "groupId": "grp_456789",
    "progress": [
      {
        "quizId": "quiz_789012",
        "title": "Python Variables and Types",
        "levelNumber": 1,
        "status": "IN_PROGRESS",
        "currentAttemptId": "att_123456",
        "totalQuestions": 5
      }
    ],
    "attemptHistory": [
      {
        "id": "att_123456",
        "submittedAt": null,
        "createdAt": "2026-07-07T10:00:00.000Z"
      }
    ]
  }
}
```

---

## Part 2: Quiz Questions & Answers

### 6. Get Quiz Questions for Attempt
Retrieve the list of questions for a quiz when taking an attempt. 
Note:
- Answer keys are stripped to prevent cheating.
- If a question contains blanks, a dynamically masked `blankQuestionText` field is returned with placeholders like `[blank_1]`, `[blank_2]`, etc. and a `blanks` metadata array is included with `keywordId` values.

**Endpoint:** `GET /student/quizzes/questions/attempt`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Query Parameters

| Parameter | Type   | Required | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| `quizId`  | string | Yes      | The ID of the quiz being attempted |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "q_101",
      "quizId": "quiz_789012",
      "questionText": "Complete the statement to define a function:",
      "blankQuestionText": "To define a [blank_2], use the [blank_1] keyword.",
      "maxScore": 100,
      "questionOrder": 1,
      "blanks": [
        {
          "keywordId": "kw_1234",
          "blankOrder": 1
        },
        {
          "keywordId": "kw_5678",
          "blankOrder": 2
        }
      ]
    }
  ]
}
```

---

### 7. Get Quiz Answers for an Attempt
Retrieve all answers submitted so far for a specific quiz attempt.

**Endpoint:** `GET /student/quizzes/answers`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Query Parameters

| Parameter       | Type   | Required | Description                                  |
| --------------- | ------ | -------- | -------------------------------------------- |
| `quizAttemptId` | string | Yes      | The ID of the quiz attempt to get answers for|

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "ans_001",
      "quizAttemptId": "att_123456",
      "quizQuestionId": "q_101",
      "questionText": "Complete the statement to define a function:",
      "answerText": "",
      "isCorrect": true,
      "answeredAt": "2026-07-07T10:05:00.000Z",
      "createdAt": "2026-07-07T10:05:00.000Z",
      "updatedAt": "2026-07-07T10:05:00.000Z",
      "items": [
        {
          "id": "item_111",
          "keywordId": "kw_1234",
          "answerText": "def",
          "isCorrect": true
        },
        {
          "id": "item_222",
          "keywordId": "kw_5678",
          "answerText": "function",
          "isCorrect": true
        }
      ]
    }
  ]
}
```

---

### 8. Submit Single Quiz Answer
Submit an answer for a single question within an active quiz attempt. For questions with blanks, provide individual answers in the `items` array.

**Endpoint:** `POST /student/quizzes/answers`  
**Auth:** Bearer Token  
**Content-Type:** `application/json`  
**Permission Required:** `student_quiz_access` (`create`)

#### Request Body (`application/json`)

| Field            | Type   | Required | Description                                                               |
| ---------------- | ------ | -------- | ------------------------------------------------------------------------- |
| `quizAttemptId`  | string | Yes      | The ID of the active quiz attempt                                         |
| `quizQuestionId` | string | Yes      | The ID of the question being answered                                     |
| `answerText`     | string | No       | The answer string (used for standard questions without blanks)            |
| `items`          | array  | No       | Array of blank answers (used for blank questions: `keywordId`, `answerText`)|

##### Items Array Object Structure
```json
{
  "keywordId": "string",
  "answerText": "string"
}
```

#### Example Request Body (With Blanks)
```json
{
  "quizAttemptId": "att_123456",
  "quizQuestionId": "q_101",
  "items": [
    { "keywordId": "kw_1234", "answerText": "def" },
    { "keywordId": "kw_5678", "answerText": "function" }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "ans_001",
    "quizAttemptId": "att_123456",
    "quizQuestionId": "q_101",
    "questionText": "Complete the statement to define a function:",
    "answerText": "",
    "isCorrect": true,
    "answeredAt": "2026-07-07T10:05:00.000Z",
    "createdAt": "2026-07-07T10:05:00.000Z",
    "updatedAt": "2026-07-07T10:05:00.000Z",
    "items": [
      {
        "id": "item_111",
        "keywordId": "kw_1234",
        "answerText": "def",
        "isCorrect": true
      },
      {
        "id": "item_222",
        "keywordId": "kw_5678",
        "answerText": "function",
        "isCorrect": true
      }
    ]
  }
}
```

---

### 9. Update Single Quiz Answer
Update an existing answer for a question in an active quiz attempt.

**Endpoint:** `PATCH /student/quizzes/answers/:id`  
**Auth:** Bearer Token  
**Content-Type:** `application/json`  
**Permission Required:** `student_quiz_access` (`update`)

#### Path Parameters

| Parameter | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `id`      | string | The unique ID of the answer to edit |

#### Request Body (`application/json`)

| Field        | Type   | Required | Description                                                         |
| ------------ | ------ | -------- | ------------------------------------------------------------------- |
| `answerText` | string | No       | The new answer string (for standard questions without blanks)       |
| `items`      | array  | No       | The updated blank answers array (for blank questions)                |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "ans_001",
    "quizAttemptId": "att_123456",
    "quizQuestionId": "q_101",
    "questionText": "Complete the statement to define a function:",
    "answerText": "",
    "isCorrect": false,
    "answeredAt": "2026-07-07T10:08:00.000Z",
    "createdAt": "2026-07-07T10:05:00.000Z",
    "updatedAt": "2026-07-07T10:08:00.000Z",
    "items": [
      {
        "id": "item_111",
        "keywordId": "kw_1234",
        "answerText": "wrong_keyword",
        "isCorrect": false
      },
      {
        "id": "item_222",
        "keywordId": "kw_5678",
        "answerText": "function",
        "isCorrect": true
      }
    ]
  }
}
```

---

### 10. Submit Bulk Quiz Answers
Submit multiple answers simultaneously for an active quiz attempt. This is useful when saving all answers at once or upon auto-submission.

**Endpoint:** `POST /student/quizzes/answers/bulk`  
**Auth:** Bearer Token  
**Content-Type:** `application/json`  
**Permission Required:** `student_quiz_access` (`create`)

#### Request Body (`application/json`)

| Field           | Type   | Required | Description                                             |
| --------------- | ------ | -------- | ------------------------------------------------------- |
| `quizId`        | string | Yes      | The ID of the quiz                                      |
| `quizAttemptId` | string | Yes      | The ID of the active quiz attempt                       |
| `answers`       | array  | Yes      | Array of answer objects (supporting `answerText` or `items`)|

##### Answer Object Structure
```json
{
  "quizQuestionId": "string",
  "answerText": "string",
  "items": [
    {
      "keywordId": "string",
      "answerText": "string"
    }
  ]
}
```

#### Example Request Body
```json
{
  "quizId": "quiz_789012",
  "quizAttemptId": "att_123456",
  "answers": [
    {
      "quizQuestionId": "q_101",
      "items": [
        { "keywordId": "kw_1234", "answerText": "def" },
        { "keywordId": "kw_5678", "answerText": "function" }
      ]
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "ans_001",
      "quizAttemptId": "att_123456",
      "quizQuestionId": "q_101",
      "answerText": "",
      "isCorrect": true,
      "answeredAt": "2026-07-07T10:10:00.000Z",
      "createdAt": "2026-07-07T10:10:00.000Z",
      "updatedAt": "2026-07-07T10:10:00.000Z",
      "items": [
        {
          "id": "item_111",
          "keywordId": "kw_1234",
          "answerText": "def",
          "isCorrect": true
        },
        {
          "id": "item_222",
          "keywordId": "kw_5678",
          "answerText": "function",
          "isCorrect": true
        }
      ]
    }
  ]
}
```

---

## Part 3: Quiz Results & Review

### 11. Get All Attempts Summary Results
Retrieve summary results for all quiz attempts. Optionally filter by `quizId` or `studentId`.

**Endpoint:** `GET /student/quizzes/attempts/results`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Query Parameters

| Parameter   | Type   | Required | Description                               |
| ----------- | ------ | -------- | ----------------------------------------- |
| `quizId`    | string | No       | Filter summary results by quiz ID         |
| `studentId` | string | No       | Filter summary results by student ID      |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "attemptId": "att_123456",
      "quizId": "quiz_789012",
      "quizTitle": "Python Variables and Types",
      "levelNumber": 1,
      "studentId": "usr_345678",
      "studentName": "John Doe",
      "studentEmail": "john@example.com",
      "score": 100,
      "totalQuestions": 5,
      "startedAt": "2026-07-07T10:00:00.000Z",
      "submittedAt": "2026-07-07T10:15:00.000Z"
    }
  ]
}
```

---

### 12. Get Detailed Quiz Attempt Result
Retrieve the full grading details and score breakdown for a completed quiz attempt, including question-by-question review, user answers, correct answers, and individual blank breakdown if the question contains blanks.

**Endpoint:** `GET /student/quizzes/attempts/:id/results`  
**Auth:** Bearer Token  
**Permission Required:** `student_quiz_access` (`read`)

#### Path Parameters

| Parameter | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `id`      | string | The unique ID of the quiz attempt   |

#### Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "attemptId": "att_123456",
    "quizId": "quiz_789012",
    "quizTitle": "Python Variables and Types",
    "levelNumber": 1,
    "score": 50,
    "startedAt": "2026-07-07T10:00:00.000Z",
    "submittedAt": "2026-07-07T10:15:00.000Z",
    "details": [
      {
        "questionId": "q_101",
        "questionText": "Complete the statement to define a function:",
        "maxScore": 100,
        "userAnswer": "",
        "correctAnswer": "To define a function, use the def keyword.",
        "isCorrect": false,
        "blanks": [
          {
            "keywordId": "kw_1234",
            "blankOrder": 1,
            "userAnswer": "def",
            "correctAnswer": "def",
            "isCorrect": true
          },
          {
            "keywordId": "kw_5678",
            "blankOrder": 2,
            "userAnswer": "incorrect_text",
            "correctAnswer": "function",
            "isCorrect": false
          }
        ]
      }
    ]
  }
}
```
