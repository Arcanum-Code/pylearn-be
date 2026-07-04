import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
