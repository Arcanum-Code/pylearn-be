import { z } from "zod";

// ==========================================
// Quiz Schema
// ==========================================
export const GetQuizLevelsQuerySchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required").describe("Required Quiz ID"),
});

export const GetQuizzesQuerySchema = z.object({
  materialId: z
    .string()
    .min(1, "Material ID is required")
    .describe("Required Material ID"),
});

export const CreateQuizSchema = z.object({
  materialId: z.string().min(1, "Material ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
});

export const UpdateQuizSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
});

export const QuizParamSchema = z.object({
  id: z.string(),
});

// ==========================================
// Question Schema
// ==========================================
export const CreateQuizLevelSchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required"),
  title: z.string().min(1, "Title is required"),
  levelOrder: z
    .number()
    .int()
    .positive("Level order must be a positive integer"),
});

export const UpdateQuizLevelSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").optional(),
  levelOrder: z
    .number()
    .int()
    .positive("Level order must be a positive integer")
    .optional(),
});

// ==========================================
// Question Schema
// ==========================================
export const GetQuestionsQuerySchema = z.object({
  quizLevelId: z
    .string()
    .min(1, "Quiz Level ID is required")
    .describe("Required Quiz Level ID"),
});

export const CreateQuizQuestionSchema = z.object({
  quizLevelId: z.string().min(1, "Quiz Level ID is required"), // Updated from quizId
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
  materialId: z.string().min(1, "Material ID is required"),
});

// ==========================================
// Keywords Schema
// ==========================================
export const GetKeywordsQuerySchema = z.object({
  questionId: z.string().describe("Required QuizQuestion ID"),
});

export const CreateKeywordSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  blankOrder: z.number().int().min(0, "Blank order must be non-negative"),
  correctAnswer: z.string().min(1, "Correct answer is required"),
});

export const UpdateKeywordSchema = z.object({
  blankOrder: z.number().int().min(0).optional(),
  correctAnswer: z.string().min(1).optional(),
});

export const KeywordParamSchema = z.object({
  id: z.string(),
});

// ==========================================
// Quiz Attempt Schema
// ==========================================
export const CreateQuizAttemptSchema = z.object({
  quizLevelId: z.string().min(1, "Quiz ID is required"),
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
  quizLevelId: z.string().min(1, "Quiz Level ID is required"),
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
export type CreateQuizLevelInput = z.infer<typeof CreateQuizLevelSchema>;
export type UpdateQuizLevelInput = z.infer<typeof UpdateQuizLevelSchema>;
export type GetQuizLevelsQueryInput = z.infer<typeof GetQuizLevelsQuerySchema>;
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
