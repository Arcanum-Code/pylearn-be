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
  createQuestionResult: createResponseSchema(QuizQuestionSafe),
  updateQuestionResult: createResponseSchema(QuizQuestionSafe),
  deleteQuestionResult: createResponseSchema(QuizDeleteSafe),

  // Keywords
  keyword: createResponseSchema(QuestionKeywordSafe),
  keywords: createResponseSchema(z.array(QuestionKeywordSafe)),

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
  createQuestionResult: z.infer<typeof QuizModel.createQuestionResult>;
  updateQuestionResult: z.infer<typeof QuizModel.updateQuestionResult>;
  deleteQuestionResult: z.infer<typeof QuizModel.deleteQuestionResult>;

  // Keywords
  keyword: z.infer<typeof QuizModel.keyword>;
  keywords: z.infer<typeof QuizModel.keywords>;
};
