import { createProtectedApp } from "@/libs/base";
import { successResponse, errorResponse } from "@/libs/response";
import { StudentGroupService } from "./service";
import { StudentGroupModel } from "./model";
import { GroupParamSchema } from "./schema";
import { GroupNotFoundError } from "@/modules/group/error";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "student_material_access";

export const studentGroups = createProtectedApp()
  .get(
    "/groups/mahasiswa/:groupId",
    async ({ params, user, set, log, locale }) => {
      const data = await StudentGroupService.getStudentGroupDetail(
        params.groupId,
        user.id,
        log,
      );
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
      params: GroupParamSchema,
      response: {
        200: StudentGroupModel.groupDetail,
        404: StudentGroupModel.error,
        500: StudentGroupModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/groups/:groupId/materials",
    async ({ params, user, set, log, locale }) => {
      const data = await StudentGroupService.getGroupMaterials(
        params.groupId,
        user.id,
        log,
      );
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
      params: GroupParamSchema,
      response: {
        200: StudentGroupModel.materialList,
        404: StudentGroupModel.error,
        500: StudentGroupModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .onError(({ error, set, locale }) => {
    if (error instanceof GroupNotFoundError) {
      return errorResponse(set, 404, { key: error.key }, null, locale);
    }
  });
