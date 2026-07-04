import { z } from "zod";
import { createResponseSchema } from "@/libs/response";

export const createQuizResponseSchema = z.object({
  quiz_id: z.string(),
  group_id: z.string(),
  level: z.number(),
  title: z.string(),
  pass_threshold: z.number(),
  status: z.string(),
  questions: z.array(z.any()),
});

export const LecturerQuizModel = {
  createResponse: createResponseSchema(createQuizResponseSchema),
} as const;
