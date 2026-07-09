import { z } from "zod";
import { createResponseSchema, createErrorSchema } from "@/libs/response";

export const StudentMaterialItemSchema = z.object({
  material_id: z.string(),
  title: z.string(),
  sequence_order: z.number().int(),
  status: z.string(),
  completed_at: z.string().nullable(),
});

export const StudentGroupQuizItemSchema = z.object({
  quiz_id: z.string(),
  title: z.string(),
  level_number: z.number().int(),
  status: z.string(),
  pass_threshold: z.number(),
  is_passed: z.boolean().nullable(),
  best_score: z.number().nullable(),
  deadline: z.string().datetime().nullable(),
});

export const StudentMaterialListSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  materials: z.array(StudentMaterialItemSchema),
  quizzes: z.array(StudentGroupQuizItemSchema),
  progress: z.object({
    completed: z.number().int(),
    total: z.number().int(),
  }),
});

const MaterialItemTimelineSchema = z.object({
  type: z.literal("material"),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  scrollPercentage: z.number().int().nullable(),
  order: z.number().int(),
});

const QuizItemTimelineSchema = z.object({
  type: z.literal("quiz"),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  deadline: z.string().datetime().nullable(),
  bestScore: z.number().nullable(),
  passThreshold: z.number(),
  isPassed: z.boolean().nullable(),
  order: z.number().int(),
});

export const StudentGroupDetailSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  description: z.string().nullable(),
  lecturerName: z.string(),
  progress: z.object({
    materialsCompleted: z.number().int(),
    materialsTotal: z.number().int(),
    percentage: z.number().int(),
  }),
  items: z.array(z.union([MaterialItemTimelineSchema, QuizItemTimelineSchema])),
});

export const StudentGroupModel = {
  materialList: createResponseSchema(StudentMaterialListSchema),
  groupDetail: createResponseSchema(StudentGroupDetailSchema),
  error: createErrorSchema(z.null()),
} as const;
