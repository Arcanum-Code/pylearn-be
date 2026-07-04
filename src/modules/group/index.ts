import { GroupService } from "./service";
import { CreateGroupSchema } from "./schema";
import { GroupModel } from "./model";
import { successResponse } from "@/libs/response";
import { createProtectedApp } from "@/libs/base";

export const group = createProtectedApp().group("/groups", (app) =>
  app.post(
    "/",
    async ({ body, set, log, locale }) => {
      const data = await GroupService.createGroup(body, log);
      return successResponse(
        set,
        data,
        { key: "common.success" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: CreateGroupSchema,
      response: {
        201: GroupModel.createResult,
      },
    },
  ),
);
