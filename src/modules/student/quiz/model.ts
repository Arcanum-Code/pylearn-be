import { z } from "zod";
import { createErrorSchema, createResponseSchema } from "@/libs/response";

// ==========================================
// QUIZ ATTEMPT SCHEMAS
// ==========================================
export const QuizProgressStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const QuizAttemptHistoryItemSchema = z.object({
  id: z.string(),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const QuizAttemptSafe = z.object({
  id: z.string(),
  quizId: z.string(),
  quizTitle: z.string().optional(),
  studentId: z.string(),
  studentName: z.string().optional(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const QuizResultQuestionSafe = z.object({
  questionId: z.string(),
  questionText: z.string(),
  maxScore: z.number(),
  userAnswer: z.string().nullable(),
  correctAnswer: z.string(),
  isCorrect: z.boolean(),
  blanks: z
    .array(
      z.object({
        keywordId: z.string(),
        blankOrder: z.number(),
        userAnswer: z.string().nullable(),
        correctAnswer: z.string(),
        isCorrect: z.boolean(),
      }),
    )
    .optional(),
});

export const QuizResultSafe = z.object({
  attemptId: z.string(),
  quizId: z.string(),
  quizTitle: z.string(),
  levelNumber: z.number().int(),
  score: z.number().nullable(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  details: z.array(QuizResultQuestionSafe),
});

export const QuizProgressItemSchema = z.object({
  quizId: z.string(),
  title: z.string(),
  levelNumber: z.number().int(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
  currentAttemptId: z.string().nullable(),
  totalQuestions: z.number().int(),
});

export const QuizProgressSafe = z.object({
  groupId: z.string(),
  progress: z.array(QuizProgressItemSchema),
  attemptHistory: z.array(QuizAttemptHistoryItemSchema),
});

export const GetAllAttemptsResultsQuerySchema = z.object({
  quizId: z.string().optional(),
  studentId: z.string().optional(),
});

export const QuizAttemptSummarySafe = z.object({
  attemptId: z.string(),
  quizId: z.string(),
  quizTitle: z.string(),
  levelNumber: z.number().int(),
  studentId: z.string(),
  studentName: z.string(),
  studentEmail: z.string(),
  score: z.number().nullable(),
  totalQuestions: z.number(),
  startedAt: z.string(),
  submittedAt: z.string().nullable(),
});

// ==========================================
// QUIZ QUESTION SCHEMAS (STUDENT PREVIEW)
// ==========================================
export const QuizQuestionWithoutAnswerText = z.object({
  id: z.string(),
  quizId: z.string(),
  questionText: z.string(),
  blankQuestionText: z.string(),
  maxScore: z.number(),
  questionOrder: z.number(),
  blanks: z.array(
    z.object({
      keywordId: z.string(),
      blankOrder: z.number(),
      correctAnswerLength: z.number(),
    }),
  ),
});

// ==========================================
// QUIZ ANSWER SCHEMAS
// ==========================================
export const QuizAnswerSafe = z.object({
  id: z.string(),
  quizAttemptId: z.string(),
  quizQuestionId: z.string(),
  questionText: z.string().optional(),
  answerText: z.string(),
  isCorrect: z.boolean(),
  answeredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z
    .array(
      z.object({
        id: z.string(),
        keywordId: z.string(),
        answerText: z.string(),
        isCorrect: z.boolean(),
      }),
    )
    .optional(),
});

// ==========================================
// ELYSIA MODEL DEFINITION
// ==========================================
export const StudentQuizModel = {
  // Questions Without Answers
  questionsWithoutAnswer: createResponseSchema(
    z.array(QuizQuestionWithoutAnswerText),
  ),

  // Attempts
  attempt: createResponseSchema(QuizAttemptSafe),
  attempts: createResponseSchema(z.array(QuizAttemptSafe)),
  createAttemptResult: createResponseSchema(QuizAttemptSafe),
  submitAttemptResult: createResponseSchema(QuizAttemptSafe),
  quizProgress: createResponseSchema(QuizProgressSafe),
  quizAttemptResult: createResponseSchema(QuizResultSafe),
  quizAllAttemptResult: createResponseSchema(z.array(QuizAttemptSummarySafe)),

  // Answers
  answer: createResponseSchema(QuizAnswerSafe),
  answers: createResponseSchema(z.array(QuizAnswerSafe)),
  createAnswerResult: createResponseSchema(QuizAnswerSafe),
  updateAnswerResult: createResponseSchema(QuizAnswerSafe),
  createBulkAnswerResult: createResponseSchema(z.array(QuizAnswerSafe)),

  // Errors
  error: createErrorSchema(z.null()),
  validationError: createErrorSchema(
    z.array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    ),
  ),
} as const;
