import { z } from "zod";

export const GroupParamSchema = z.object({
  groupId: z.string(),
});
