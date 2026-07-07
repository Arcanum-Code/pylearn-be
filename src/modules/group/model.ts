import { z } from "zod";
import { createErrorSchema, createResponseSchema } from "@/libs/response";

export const GroupSafe = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  _count: z
    .object({
      users: z.number().int(),
      materials: z.number().int(),
      quizzes: z.number().int(),
    })
    .optional(),
});

export const GroupMaterialSafe = z.object({
  id: z.string(),
  title: z.string(),
  publishedAt: z.string().datetime().nullable(),
});

export const GroupQuizSafe = z.object({
  id: z.string(),
  title: z.string(),
  levelNumber: z.number().int(),
  isPublished: z.boolean(),
});

export const GroupDetailSafe = GroupSafe.extend({
  materials: z.array(GroupMaterialSafe),
  quizzes: z.array(GroupQuizSafe),
});

export const GroupModel = {
  createResult: createResponseSchema(GroupSafe),
  listResult: createResponseSchema(z.array(GroupSafe)),
  detailResult: createResponseSchema(GroupDetailSafe),
  updateResult: createResponseSchema(GroupSafe),
  deleteResult: createResponseSchema(z.object({ success: z.boolean() })),
  error: createErrorSchema(z.null()),
};
