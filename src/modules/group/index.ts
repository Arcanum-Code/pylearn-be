import { GroupService } from "./service";
import { CreateGroupSchema, UpdateGroupSchema } from "./schema";
import { GroupModel } from "./model";
import { successResponse, errorResponse } from "@/libs/response";
import { createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";
import { z } from "zod";
import { GroupNotFoundError } from "./error";

const FEATURE = "group_management";

export const group = createProtectedApp()
  .onError(({ error, set, locale }) => {
    if (error instanceof GroupNotFoundError) {
      return errorResponse(set, 404, { key: error.key }, null, locale);
    }
  })
  .group("/groups", (app) =>
    app
      .get(
        "/",
        async ({ set, log, locale }) => {
          const data = await GroupService.getGroups(log);
          return successResponse(
            set,
            data,
            { key: "common.success" },
            200,
            undefined,
            locale,
          );
        },
        {
          response: {
            200: GroupModel.listResult,
          },
          beforeHandle: hasPermission(FEATURE, "read"),
          detail: {
            tags: ["Group"],
            summary: "Retrieve all groups",
          },
        },
      )
      .get(
        "/:id",
        async ({ params: { id }, set, log, locale }) => {
          const data = await GroupService.getGroupById(id, log);
          return successResponse(
            set,
            data,
            { key: "common.success" },
            200,
            undefined,
            locale,
          );
        },
        {
          params: z.object({ id: z.string() }),
          response: {
            200: GroupModel.detailResult,
          },
          beforeHandle: hasPermission(FEATURE, "read"),
          detail: {
            tags: ["Group"],
            summary: "Retrieve group by ID",
            responses: {
              200: {
                description: "Group details retrieved successfully",
                content: {
                  "application/json": {
                    example: {
                      error: false,
                      data: {
                        id: "cmr68f8u60097ijq739906nm1",
                        name: "Week 1",
                        description: "Introduction",
                        createdAt: "2026-07-04T10:41:24.000Z",
                        updatedAt: "2026-07-04T10:41:24.000Z",
                        materials: [
                          {
                            id: "1",
                            title: "Lecture Notes",
                            isPublished: true,
                          },
                        ],
                        quizzes: [
                          {
                            id: "2",
                            title: "Week 1 Quiz",
                            levelNumber: 1,
                            isPublished: true,
                          },
                        ],
                      },
                      message: "Success",
                      meta: null,
                    },
                  },
                },
              },
            },
          },
        },
      )
      .post(
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
          beforeHandle: hasPermission(FEATURE, "create"),
          detail: {
            tags: ["Group"],
            summary: "Create a new group",
          },
        },
      )
      .patch(
        "/:id",
        async ({ params: { id }, body, set, log, locale }) => {
          const data = await GroupService.updateGroup(id, body, log);
          return successResponse(
            set,
            data,
            { key: "common.success" },
            200,
            undefined,
            locale,
          );
        },
        {
          params: z.object({ id: z.string() }),
          body: UpdateGroupSchema,
          response: {
            200: GroupModel.updateResult,
          },
          beforeHandle: hasPermission(FEATURE, "update"),
          detail: {
            tags: ["Group"],
            summary: "Update group details",
          },
        },
      )
      .delete(
        "/:id",
        async ({ params: { id }, set, log, locale }) => {
          const data = await GroupService.deleteGroup(id, log);
          return successResponse(
            set,
            data,
            { key: "common.success" },
            200,
            undefined,
            locale,
          );
        },
        {
          params: z.object({ id: z.string() }),
          response: {
            200: GroupModel.deleteResult,
          },
          beforeHandle: hasPermission(FEATURE, "delete"),
          detail: {
            tags: ["Group"],
            summary: "Delete a group",
          },
        },
      ),
  );
