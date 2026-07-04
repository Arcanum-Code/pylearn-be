import { z } from "zod";
import { createResponseSchema } from "@/libs/response";

export const GroupSafe = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GroupModel = {
  createResult: createResponseSchema(GroupSafe),
};
