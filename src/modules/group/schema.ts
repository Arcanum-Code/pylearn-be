import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
