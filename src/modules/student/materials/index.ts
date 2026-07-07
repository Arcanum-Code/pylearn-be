import { createProtectedApp } from "@/libs/base";
import { successResponse, errorResponse } from "@/libs/response";
import { StudentMaterialService } from "./service";
import { StudentMaterialModel } from "./model";
import {
  GroupParamSchema,
  MaterialParamSchema,
  UpdateProgressSchema,
} from "./schema";
import { GroupNotFoundError } from "@/modules/group/error";
import { MaterialNotFoundError } from "./error";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "student_material_access";

export const studentMaterials = createProtectedApp()
  .get(
    "/groups/mahasiswa/:groupId",
    async ({ params, user, set, log, locale }) => {
      const data = await StudentMaterialService.getStudentGroupDetail(
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
        200: StudentMaterialModel.groupDetail,
        404: StudentMaterialModel.error,
        500: StudentMaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/groups/:groupId/materials",
    async ({ params, user, set, log, locale }) => {
      const data = await StudentMaterialService.getGroupMaterials(
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
        200: StudentMaterialModel.materialList,
        404: StudentMaterialModel.error,
        500: StudentMaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/materials/:materialId",
    async ({ params, user, set, log, locale }) => {
      const data = await StudentMaterialService.getMaterialDetail(
        BigInt(params.materialId),
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
      params: MaterialParamSchema,
      response: {
        200: StudentMaterialModel.materialDetail,
        404: StudentMaterialModel.error,
        500: StudentMaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .patch(
    "/materials/:materialId/progress",
    async ({ params, body, user, set, log, locale }) => {
      const data = await StudentMaterialService.updateProgress(
        BigInt(params.materialId),
        user.id,
        body,
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
      params: MaterialParamSchema,
      body: UpdateProgressSchema,
      response: {
        200: StudentMaterialModel.progressUpdate,
        404: StudentMaterialModel.error,
        500: StudentMaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .onError(({ error, set, locale }) => {
    if (
      error instanceof GroupNotFoundError ||
      error instanceof MaterialNotFoundError
    ) {
      return errorResponse(set, 404, { key: error.key }, null, locale);
    }
  });
