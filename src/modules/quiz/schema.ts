import { z } from "zod";

// ==========================================
// Quiz Schema
// ==========================================
export const GetQuizzesQuerySchema = z.object({
  groupId: z
    .string()
    .min(1, "Group ID is required")
    .describe("Required Group ID"),
});

export const CreateQuizSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
  levelNumber: z.number().int().positive("Level number must be positive"),
  passThreshold: z.number().min(0).max(100).default(70.0),
  prerequisiteMaterialIds: z.array(z.string()).optional(),
});

export const UpdateQuizSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
  levelNumber: z.number().int().positive().optional(),
  passThreshold: z.number().min(0).max(100).optional(),
  prerequisiteMaterialIds: z.array(z.string()).optional(),
});

export const QuizParamSchema = z.object({
  id: z.string(),
});

// ==========================================
// Question Schema
// ==========================================
export const GetQuestionsQuerySchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required").describe("Required Quiz ID"),
});

export const CreateQuizQuestionSchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required"),
  questionText: z.string().min(1, "Question text is required"),
  answerText: z.string().min(1, "Answer text is required"),
  maxScore: z
    .number()
    .int()
    .positive("Max score must be a positive integer")
    .default(100),
  questionOrder: z
    .number()
    .int()
    .positive("Question order must be a positive integer"),
});

export const UpdateQuizQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text cannot be empty").optional(),
  answerText: z.string().min(1, "Answer text cannot be empty").optional(),
  maxScore: z
    .number()
    .int()
    .positive("Max score must be a positive integer")
    .optional(),
  questionOrder: z
    .number()
    .int()
    .positive("Question order must be a positive integer")
    .optional(),
});

export const QuestionParamSchema = z.object({
  id: z.string(),
});

export const GetGroupedQuestionsQuerySchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
});

// ==========================================
// Keywords Schema
// ==========================================
export const GetKeywordsQuerySchema = z.object({
  questionId: z.string().describe("Required QuizQuestion ID"),
});

export const CreateKeywordSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  blankOrder: z.number().int().min(1, "Blank order must be at least 1"),
  correctAnswer: z.string().min(1, "Correct answer is required"),
});

export const UpdateKeywordSchema = z.object({
  blankOrder: z.number().int().min(1).optional(),
  correctAnswer: z.string().min(1).optional(),
});

export const KeywordParamSchema = z.object({
  id: z.string(),
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

export type CreateQuizInput = z.infer<typeof CreateQuizSchema>;
export type UpdateQuizInput = z.infer<typeof UpdateQuizSchema>;
export type CreateQuizQuestionInput = z.infer<typeof CreateQuizQuestionSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof UpdateQuizQuestionSchema>;
export type CreateKeywordInput = z.infer<typeof CreateKeywordSchema>;
export type UpdateKeywordInput = z.infer<typeof UpdateKeywordSchema>;
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
