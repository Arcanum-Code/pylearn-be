import { z } from "zod";
import { createErrorSchema, createResponseSchema } from "@/libs/response";

// ==========================================
// KEYWORD SCHEMAS
// ==========================================
export const QuestionKeywordSafe = z.object({
  id: z.string(),
  questionId: z.string(),
  blankOrder: z.number().int(),
  correctAnswer: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  quizId: z.string().optional(),
  quizTitle: z.string().optional(),
});

// ==========================================
// QUIZ PREREQUISITE SCHEMAS
// ==========================================
export const QuizPrerequisiteSafe = z.object({
  id: z.string(),
  quizId: z.string(),
  materialId: z.string(),
  materialTitle: z.string().optional(),
});

// ==========================================
// QUIZ SCHEMAS
// ==========================================
export const QuizSafe = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  isPublished: z.boolean(),
  levelNumber: z.number().int(),
  passThreshold: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  prerequisites: z.array(QuizPrerequisiteSafe),
});

export const QuizCreateSafe = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  isPublished: z.boolean(),
  levelNumber: z.number().int(),
  passThreshold: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const QuizDeleteSafe = z.object({
  id: z.string(),
});

// ==========================================
// QUESTION SCHEMAS
// ==========================================
export const QuizQuestionSafe = z.object({
  id: z.string(),
  quizId: z.string(),
  quizTitle: z.string().optional(),
  questionText: z.string(),
  answerText: z.string(),
  maxScore: z.number(),
  questionOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  keywords: z.array(QuestionKeywordSafe).optional(),
});

export const QuizQuestionWithoutAnswerText = z.object({
  id: z.string(),
  quizId: z.string(),
  questionText: z.string(),
  maxScore: z.number(),
  questionOrder: z.number(),
});

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
});

// ==========================================
// ELYSIA MODEL DEFINITION
// ==========================================
export const QuizModel = {
  // Quiz
  quiz: createResponseSchema(QuizSafe),
  quizzes: createResponseSchema(z.array(QuizSafe)),
  createResult: createResponseSchema(QuizCreateSafe),
  updateResult: createResponseSchema(QuizCreateSafe),
  deleteResult: createResponseSchema(QuizDeleteSafe),

  // Questions
  question: createResponseSchema(QuizQuestionSafe),
  questions: createResponseSchema(z.array(QuizQuestionSafe)),
  questionsWithoutAnswer: createResponseSchema(
    z.array(QuizQuestionWithoutAnswerText),
  ),
  createQuestionResult: createResponseSchema(QuizQuestionSafe),
  updateQuestionResult: createResponseSchema(QuizQuestionSafe),
  deleteQuestionResult: createResponseSchema(QuizDeleteSafe),

  // Keywords
  keyword: createResponseSchema(QuestionKeywordSafe),
  keywords: createResponseSchema(z.array(QuestionKeywordSafe)),

  // Attempts
  attempt: createResponseSchema(QuizAttemptSafe),
  attempts: createResponseSchema(z.array(QuizAttemptSafe)),
  createAttemptResult: createResponseSchema(QuizAttemptSafe),
  submitAttemptResult: createResponseSchema(QuizAttemptSafe),
  quizProgress: createResponseSchema(QuizProgressSafe),
  quizAttemptResult: createResponseSchema(QuizResultSafe),
  quizAllAttemptResult: createResponseSchema(z.array(QuizAttemptSummarySafe)),

  // Answer
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

export type QuizModelType = {
  // Quiz
  quiz: z.infer<typeof QuizModel.quiz>;
  quizzes: z.infer<typeof QuizModel.quizzes>;
  createResult: z.infer<typeof QuizModel.createResult>;
  updateResult: z.infer<typeof QuizModel.updateResult>;
  deleteResult: z.infer<typeof QuizModel.deleteResult>;

  // Questions
  question: z.infer<typeof QuizModel.question>;
  questions: z.infer<typeof QuizModel.questions>;
  questionsWithoutAnswer: z.infer<typeof QuizModel.questionsWithoutAnswer>;
  createQuestionResult: z.infer<typeof QuizModel.createQuestionResult>;
  updateQuestionResult: z.infer<typeof QuizModel.updateQuestionResult>;
  deleteQuestionResult: z.infer<typeof QuizModel.deleteQuestionResult>;

  // Keywords
  keyword: z.infer<typeof QuizModel.keyword>;
  keywords: z.infer<typeof QuizModel.keywords>;

  // Attempts
  attempt: z.infer<typeof QuizModel.attempt>;
  attempts: z.infer<typeof QuizModel.attempts>;
  createAttemptResult: z.infer<typeof QuizModel.createAttemptResult>;
  submitAttemptResult: z.infer<typeof QuizModel.submitAttemptResult>;
  quizProgress: z.infer<typeof QuizModel.quizProgress>;
  quizAttemptResult: z.infer<typeof QuizModel.quizAttemptResult>;
  quizAttemptAllResult: z.infer<typeof QuizModel.quizAllAttemptResult>;

  // Answer
  answer: z.infer<typeof QuizModel.answer>;
  answers: z.infer<typeof QuizModel.answers>;
  createAnswerResult: z.infer<typeof QuizModel.createAnswerResult>;
  updateAnswerResult: z.infer<typeof QuizModel.updateAnswerResult>;
};
