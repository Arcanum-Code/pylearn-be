import { z } from "zod";
import {
  createErrorSchema,
  createPaginatedResponseSchema,
  createResponseSchema,
} from "@/libs/response";

export const MaterialSafe = z.object({
  id: z.string(),
  lecturerId: z.string(),
  groupId: z.string(),
  sequence: z.number().int(),
  version: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  materialType: z.string(),
  content: z.string().nullable(),
  sourceUrl: z.string().nullable(),

  isPublished: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MaterialModel = {
  material: createResponseSchema(MaterialSafe),
  materials: createPaginatedResponseSchema(z.array(MaterialSafe)),
  createResult: createResponseSchema(MaterialSafe),
  createMeResult: createResponseSchema(MaterialSafe),
  updateResult: createResponseSchema(MaterialSafe),
  deleteResult: createResponseSchema(MaterialSafe),

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

export type MaterialModelType = {
  material: z.infer<typeof MaterialModel.material>;
  materials: z.infer<typeof MaterialModel.materials>;
  createResult: z.infer<typeof MaterialModel.createResult>;
  updateResult: z.infer<typeof MaterialModel.updateResult>;
  deleteResult: z.infer<typeof MaterialModel.deleteResult>;
};
