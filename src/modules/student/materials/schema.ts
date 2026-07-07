import { z } from "zod";

export const MaterialParamSchema = z.object({
  materialId: z.string(),
});

export const UpdateProgressSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
  scroll_percentage: z.number().min(0).max(100).optional(),
});
