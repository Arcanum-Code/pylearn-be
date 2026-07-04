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

export const StudentMaterialModel = {
  materialList: createResponseSchema(StudentMaterialListSchema),
  materialDetail: createResponseSchema(StudentMaterialDetailSchema),
  progressUpdate: createResponseSchema(StudentProgressUpdateSchema),
  error: createErrorSchema(z.null()),
} as const;
