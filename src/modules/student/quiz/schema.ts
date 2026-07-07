import { z } from "zod";

// ==========================================
// Quiz Schema for Student Query
// ==========================================
export const GetQuestionsQuerySchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required").describe("Required Quiz ID"),
});

// ==========================================
// Quiz Attempt Schema
// ==========================================
export const CreateQuizAttemptSchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required"),
});

export const GetQuizAttemptsQuerySchema = z.object({
  quizId: z.string().optional(),
  studentId: z.string().optional(),
});

export const SubmitQuizAttemptSchema = z.object({
  submittedAt: z.string().datetime(),
});

export const QuizAttemptParamSchema = z.object({
  id: z.string(),
});

// ==========================================
// Quiz Answer Schema
// ==========================================
export const GetQuizAnswersQuerySchema = z.object({
  quizAttemptId: z.string().min(1, "Quiz Attempt ID is required"),
});

export const CreateQuizAnswerSchema = z.object({
  quizAttemptId: z.string().min(1, "Quiz Attempt ID is required"),
  quizQuestionId: z.string().min(1, "Quiz Question ID is required"),
  answerText: z.string().min(1, "Answer text is required"),
});

export const UpdateQuizAnswerSchema = z.object({
  answerText: z.string().min(1, "Answer text cannot be empty"),
});

export const QuizAnswerParamSchema = z.object({
  id: z.string(),
});

export const CreateBulkQuizAnswerSchema = z.object({
  quizAttemptId: z.string().min(1, "Quiz Attempt ID is required"),
  quizId: z.string().min(1, "Quiz ID is required"),
  answers: z
    .array(
      z.object({
        quizQuestionId: z.string().min(1, "Question ID is required"),
        answerText: z.string().min(1, "Answer text cannot be empty"),
      }),
    )
    .min(1, "At least one answer must be submitted"),
});

export type CreateQuizAttemptInput = z.infer<typeof CreateQuizAttemptSchema>;
export type SubmitQuizAttemptInput = z.infer<typeof SubmitQuizAttemptSchema>;
export type CreateQuizAnswerInput = z.infer<typeof CreateQuizAnswerSchema>;
export type UpdateQuizAnswerInput = z.infer<typeof UpdateQuizAnswerSchema>;
export type GetQuizAttemptsQueryInput = z.infer<
  typeof GetQuizAttemptsQuerySchema
>;
export type GetQuizAnswersQueryInput = z.infer<
  typeof GetQuizAnswersQuerySchema
>;
export type CreateBulkQuizAnswerInput = z.infer<
  typeof CreateBulkQuizAnswerSchema
>;
