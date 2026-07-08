import { z } from "zod";

export const StudentsActivityQuerySchema = z.object({
  status: z
    .enum(["ALL", "AT_RISK", "INACTIVE", "ON_TRACK"])
    .optional()
    .default("ALL"),
  search: z.string().optional(),
  sortBy: z.enum(["name", "progress", "quiz_score", "last_active"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type StudentsActivityQuery = z.infer<typeof StudentsActivityQuerySchema>;
