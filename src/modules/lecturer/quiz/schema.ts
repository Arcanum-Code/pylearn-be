import { z } from "zod";

export const createQuizSchema = z.object({
  level: z.number().int().min(1),
  title: z.string().min(1),
  pass_threshold: z.number().min(0).max(100).default(70),
});

export const updateQuizSchema = createQuizSchema.partial();
