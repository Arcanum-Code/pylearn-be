import { z } from "zod";
import { createErrorSchema, createResponseSchema } from "@/libs/response";

// ==========================================
// QUIZ LEVEL SCHEMAS
// ==========================================
export const QuizLevelSafe = z.object({
  id: z.string(),
  quizId: z.string(),
  title: z.string(),
  levelOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ==========================================
// QUIZ SCHEMAS
// ==========================================
export const QuizSafe = z.object({
  id: z.string(),
  materialId: z.string(),
  material: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  isPublished: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  levels: z.array(QuizLevelSafe),
});

export const QuizCreateSafe = z.object({
  id: z.string(),
  materialId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  isPublished: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  levels: z.array(QuizLevelSafe),
});

export const QuizDeleteSafe = z.object({
  id: z.string(),
});

// ==========================================
// QUESTION SCHEMAS
// ==========================================
export const QuizQuestionSafe = z.object({
  id: z.string(),
  quizLevelId: z.string(),
  quizLevelTitle: z.string().optional(),
  quizId: z.string().optional(),
  quizTitle: z.string().optional(),
  questionText: z.string(),
  answerText: z.string(),
  maxScore: z.number(),
  questionOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const QuizQuestionWithoutAnswerText = z.object({
  id: z.string(),
  quizLevelId: z.string(),
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
  quizLevelId: z.string(),
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
  quizLevelId: z.string(),
  quizTitle: z.string(),
  levelTitle: z.string(),
  score: z.number().nullable(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  details: z.array(QuizResultQuestionSafe),
});

export const QuizLevelProgressSchema = z.object({
  levelId: z.string(),
  title: z.string(),
  levelOrder: z.number().int(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
  currentAttemptId: z.string().nullable(),
  totalQuestions: z.number().int(),
});

export const QuizProgressSafe = z.object({
  quizId: z.string(),
  levels: z.array(QuizLevelProgressSchema),
  attemptHistory: z.array(QuizAttemptHistoryItemSchema),
});

// Filter schema incoming from URL Query string strings
export const GetAllAttemptsResultsQuerySchema = z.object({
  quizLevelId: z.string().optional(),
  studentId: z.string().optional(),
});

// Row representation inside the returned overview table list array
export const QuizAttemptSummarySafe = z.object({
  attemptId: z.string(),
  quizLevelId: z.string(),
  quizTitle: z.string(),
  levelTitle: z.string(),
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
// GROUPED SCHEMAS
// ==========================================
export const GroupedQuestion = z.object({
  id: z.string(),
  questionText: z.string(),
  maxScore: z.number(),
  questionOrder: z.number(),
});

export const GroupedQuiz = z.object({
  quizId: z.string(),
  quizTitle: z.string(),
  questions: z.array(GroupedQuestion),
});

export const GroupedMaterialLevel = z.object({
  levelId: z.string(),
  levelTitle: z.string(),
  quizzes: z.array(GroupedQuiz),
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

  // Quiz Levels (NEW)
  level: createResponseSchema(QuizLevelSafe),
  levels: createResponseSchema(z.array(QuizLevelSafe)),
  createLevelResult: createResponseSchema(QuizLevelSafe),
  updateLevelResult: createResponseSchema(QuizLevelSafe),
  deleteLevelResult: createResponseSchema(QuizDeleteSafe),

  // Questions
  question: createResponseSchema(QuizQuestionSafe),
  questions: createResponseSchema(z.array(QuizQuestionSafe)),
  questionsWithoutAnswer: createResponseSchema(
    z.array(QuizQuestionWithoutAnswerText),
  ),
  createQuestionResult: createResponseSchema(QuizQuestionSafe),
  updateQuestionResult: createResponseSchema(QuizQuestionSafe),
  deleteQuestionResult: createResponseSchema(QuizDeleteSafe),

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

  // Quiz Levels
  level: z.infer<typeof QuizModel.level>;
  levels: z.infer<typeof QuizModel.levels>;
  createLevelResult: z.infer<typeof QuizModel.createLevelResult>;
  updateLevelResult: z.infer<typeof QuizModel.updateLevelResult>;
  deleteLevelResult: z.infer<typeof QuizModel.deleteLevelResult>;

  // Questions
  question: z.infer<typeof QuizModel.question>;
  questions: z.infer<typeof QuizModel.questions>;
  questionsWithoutAnswer: z.infer<typeof QuizModel.questionsWithoutAnswer>;
  createQuestionResult: z.infer<typeof QuizModel.createQuestionResult>;
  updateQuestionResult: z.infer<typeof QuizModel.updateQuestionResult>;
  deleteQuestionResult: z.infer<typeof QuizModel.deleteQuestionResult>;

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
