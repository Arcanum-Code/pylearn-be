import { z } from "zod";

export const DashboardParamSchema = z.object({
  groupId: z.string(),
});

export const StudentParamSchema = z.object({
  groupId: z.string(),
  studentId: z.string(),
});

export const QuizParamSchema = z.object({
  quizId: z.string(),
});

export const StudentTableQuerySchema = z.object({
  status: z.enum(["on_track", "stuck", "inactive"]).optional(),
  search: z.string().optional(),
  sort: z.enum(["materials_read", "last_activity"]).default("last_activity"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.string().regex(/^\d+$/).default("1"),
  page_size: z.string().regex(/^\d+$/).default("25"),
});

export const NudgeBodySchema = z.object({
  message: z.string().min(1),
});

export const CalendarQuerySchema = z.object({
  year: z.coerce.number().int().min(1000).max(9999),
  month: z.coerce.number().int().min(1).max(12),
  groupId: z.string().optional(),
});

export const RecentActivityQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(10),
  groupId: z.string().optional(),
});
