import { z } from "zod";
import { createResponseSchema, createErrorSchema } from "@/libs/response";

export const StudentMaterialItemSchema = z.object({
  material_id: z.string(),
  title: z.string(),
  sequence_order: z.number().int(),
  status: z.string(),
  completed_at: z.string().nullable(),
});

export const StudentMaterialListSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  materials: z.array(StudentMaterialItemSchema),
  progress: z.object({
    completed: z.number().int(),
    total: z.number().int(),
  }),
});

export const StudentMaterialDetailSchema = z.object({
  material_id: z.string(),
  group_id: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  attachment_url: z.string().nullable(),
  sequence_order: z.number().int(),
  status: z.string(),
  scroll_percentage: z.number().int().nullable(),
  navigation: z.object({
    prev_material_id: z.string().nullable(),
    next_material_id: z.string().nullable(),
  }),
});

export const StudentProgressUpdateSchema = z.object({
  material_id: z.string(),
  status: z.string(),
  scroll_percentage: z.number().int().nullable(),
  completed_at: z.string().nullable(),
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

export const StudentMaterialModel = {
  materialList: createResponseSchema(StudentMaterialListSchema),
  materialDetail: createResponseSchema(StudentMaterialDetailSchema),
  progressUpdate: createResponseSchema(StudentProgressUpdateSchema),
  groupDetail: createResponseSchema(StudentGroupDetailSchema),
  error: createErrorSchema(z.null()),
} as const;
