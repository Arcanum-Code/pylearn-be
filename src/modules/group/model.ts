import { z } from "zod";
import { createResponseSchema } from "@/libs/response";

export const GroupSafe = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GroupMaterialSafe = z.object({
  id: z
    .string()
    .or(z.bigint())
    .transform((v) => v.toString()),
  title: z.string(),
  isPublished: z.boolean(),
});

export const GroupQuizSafe = z.object({
  id: z
    .string()
    .or(z.bigint())
    .transform((v) => v.toString()),
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
};
