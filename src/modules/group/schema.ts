import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  level: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]).optional(),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  level: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]).optional(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
