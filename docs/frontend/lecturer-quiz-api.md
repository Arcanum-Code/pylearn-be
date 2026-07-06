# Lecturer Quiz API Documentation

This document outlines the 10 API endpoints available for lecturers to manage Quizzes and their Questions. All endpoints require a valid JWT `Authorization: Bearer <token>` header.

## Part 1: Quiz Management

### 1. List Quizzes in a Group
Retrieve a list of all quizzes inside a specific student group.

**Endpoint:** `GET /lecturer/groups/:groupId/quizzes`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`read`)

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "quizzes": [
      {
        "quiz_id": "quiz123...",
        "level": 1,
        "title": "Variable Scope",
        "status": "draft",
        "question_count": 5
      }
    ]
  }
}
```

### 2. Get Quiz Details
Retrieve detailed information for a specific quiz, including all its questions, blanks, and gating materials.

**Endpoint:** `GET /lecturer/quizzes/:quizId`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`read`)

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "quiz_id": "quiz123...",
    "group_id": "grp456...",
    "level": 1,
    "title": "Variable Scope",
    "status": "draft",
    "pass_threshold": 70,
    "questions": [
      {
        "question_id": "q123...",
        "question_text": "To define a function, use the {def} keyword.",
        "key_answer_text": "To define a function, use the {def} keyword.",
        "sequence_order": 1,
        "blanks": [
          {
            "blank_id": "b123...",
            "keyword": "def",
            "start_index": 30,
            "end_index": 33
          }
        ]
      }
    ],
    "gating_materials": [
      {
        "material_id": "mat123...",
        "title": "Introduction to Functions",
        "sequence": 1
      }
    ]
  }
}
```

### 3. Create a Quiz
Create a new quiz within a student group.

**Endpoint:** `POST /lecturer/groups/:groupId/quizzes`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`create`)

**Request Body:**
```json
{
  "level": 1,
  "title": "Variable Scope",
  "pass_threshold": 70 // Optional, default is 70
}
```

### 4. Update a Quiz
Update the properties of an existing quiz.

**Endpoint:** `PATCH /lecturer/quizzes/:quizId`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`update`)

**Request Body:** *(All fields optional)*
```json
{
  "level": 1,
  "title": "Updated Title",
  "pass_threshold": 80
}
```

### 5. Delete a Quiz
Delete a quiz entirely.

**Endpoint:** `DELETE /lecturer/quizzes/:quizId`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`delete`)

### 6. Publish a Quiz
Mark a quiz as published, making it visible/active for students.

**Endpoint:** `POST /lecturer/quizzes/:quizId/publish`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`update`)

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "quiz_id": "quiz123...",
    "status": "published"
  }
}
```

---

## Part 2: Question & Blank Management

### 7. Create a Question
Add a new question to a quiz.

**Endpoint:** `POST /lecturer/quizzes/:quizId/questions`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`update`)

**Request Body:**
```json
{
  "question_text": "To define a function, use the ___ keyword.",
  "key_answer_text": "To define a function, use the def keyword.",
  "sequence_order": 1
}
```

### 8. Update a Question
Modify the text or order of an existing question. Note: Changing `key_answer_text` might invalidate existing blanks.

**Endpoint:** `PATCH /lecturer/questions/:questionId`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`update`)

**Request Body:** *(All fields optional)*
```json
{
  "question_text": "Updated question text",
  "key_answer_text": "Updated answer text",
  "sequence_order": 2
}
```

### 9. Delete a Question
Delete a question from a quiz.

**Endpoint:** `DELETE /lecturer/questions/:questionId`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`delete`)

### 10. Replace Blanks for a Question
Set or replace the exact blank configurations (keywords and their index positions) for a question's key answer text.

**Endpoint:** `PUT /lecturer/questions/:questionId/blanks`
**Auth:** Bearer Token
**Permission Required:** `lecturer_quiz_access` (`update`)

**Request Body:**
```json
{
  "blanks": [
    {
      "keyword": "def",
      "start_index": 30, // The starting character index of the blank in key_answer_text
      "end_index": 33    // The ending character index of the blank
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "question_id": "q123...",
    "blanks": [
      {
        "blank_id": "b123...",
        "keyword": "def",
        "start_index": 30,
        "end_index": 33
      }
    ]
  }
}
```
