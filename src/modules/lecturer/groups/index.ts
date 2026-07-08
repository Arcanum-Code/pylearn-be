import { createProtectedApp } from "@/libs/base";
import { successResponse, errorResponse } from "@/libs/response";
import { hasPermission } from "@/middleware/permission";
import { LecturerGroupsService } from "./service";
import { StudentsActivityQuerySchema } from "./schema";
import { LecturerGroupsModel } from "./model";
import { LecturerGroupsError } from "./error";

const FEATURE_NAME = "group_management";

export const lecturerGroups = createProtectedApp({ tags: ["Lecturer Groups"] })
  .get(
    "/groups/:groupId/students-activity",
    async ({ set, params, query, log, locale }) => {
      const result = await LecturerGroupsService.getStudentsActivity(
        params.groupId,
        query,
        log,
      );
      return successResponse(
        set,
        result,
        { key: "common.success" },
        200,
        undefined,
        locale,
      );
    },
    {
      query: StudentsActivityQuerySchema,
      response: { 200: LecturerGroupsModel.studentsActivityResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/groups/:groupId/students/:studentId/activity",
    async ({ set, params, log, locale }) => {
      const result = await LecturerGroupsService.getStudentActivityDetail(
        params.groupId,
        params.studentId,
        log,
      );
      return successResponse(
        set,
        result,
        { key: "common.success" },
        200,
        undefined,
        locale,
      );
    },
    {
      response: { 200: LecturerGroupsModel.studentActivityDetailResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .onError(({ error, set, locale }) => {
    if (error instanceof LecturerGroupsError) {
      return errorResponse(
        set,
        error.status,
        { key: error.key },
        error.details,
        locale,
      );
    }
  });
