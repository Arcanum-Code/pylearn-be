import { MaterialService } from "./service";
import { MaterialModel } from "./model";
import {
  CreateMaterialSchema,
  CreateMaterialMeSchema,
  GetMaterialsQuerySchema,
  UpdateMaterialSchema,
  MaterialParamSchema,
} from "./schema";
import { successResponse, errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { Prisma } from "@generated/prisma";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "material_management";

const protectedMaterials = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const {
        page = 1,
        limit = 10,
        lecturerId,
        materialType,
        isPublished,
      } = query;

      const { materials, pagination } = await MaterialService.getMaterials(
        {
          page,
          limit,
          lecturerId,
          materialType,
          isPublished,
        },
        log,
      );

      return successResponse(
        set,
        materials,
        { key: "materials.listSuccess" },
        200,
        {
          pagination,
        },
        locale,
      );
    },
    {
      query: GetMaterialsQuerySchema,
      response: {
        200: MaterialModel.materials,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .post(
    "/",
    async ({ body, set, log, locale }) => {
      const data = await MaterialService.createMaterial(body, log);
      return successResponse(
        set,
        data,
        { key: "materials.createSuccess" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: CreateMaterialSchema,
      type: "multipart/form-data",
      response: {
        201: MaterialModel.createResult,
        400: MaterialModel.validationError,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "create"),
    },
  )
  .post(
    "/me",
    async ({ body, user, set, log, locale }) => {
      const data = await MaterialService.createMaterialMe(body, user.id, log);

      return successResponse(
        set,
        data,
        { key: "materials.createSuccess" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: CreateMaterialMeSchema,
      type: "multipart/form-data",
      response: {
        201: MaterialModel.createMeResult,
        400: MaterialModel.validationError,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "create"),
    },
  )
  .get(
    "/:id",
    async ({ params, set, log, locale }) => {
      const id = BigInt(params.id);
      const data = await MaterialService.getMaterial(id, log);
      return successResponse(
        set,
        data,
        { key: "materials.getSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: MaterialParamSchema,
      response: {
        200: MaterialModel.material,
        404: MaterialModel.error,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, locale }) => {
      const id = BigInt(params.id);

      // The body payload will now correctly contain either text fields or the File object
      const data = await MaterialService.updateMaterial(id, body, log);

      return successResponse(
        set,
        data,
        { key: "materials.updateSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: MaterialParamSchema,
      body: UpdateMaterialSchema,
      type: "multipart/form-data",
      response: {
        200: MaterialModel.updateResult,
        400: MaterialModel.validationError,
        404: MaterialModel.error,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .post(
    "/:id/publish",
    async ({ params, set, log, locale }) => {
      const id = BigInt(params.id);
      const data = await MaterialService.updateMaterial(
        id,
        { isPublished: true },
        log,
      );
      return successResponse(
        set,
        data,
        { key: "materials.updateSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: MaterialParamSchema,
      response: {
        200: MaterialModel.updateResult,
        404: MaterialModel.error,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, log, locale }) => {
      const id = BigInt(params.id);
      const data = await MaterialService.deleteMaterial(id, log);
      return successResponse(
        set,
        data,
        { key: "materials.deleteSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: MaterialParamSchema,
      response: {
        200: MaterialModel.deleteResult,
        404: MaterialModel.error,
        500: MaterialModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "delete"),
    },
  )
  .onError(({ error, set, locale }) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      const rawField = (error.meta?.field_name as string) || "unknown";
      const match = rawField.match(/_([a-zA-Z0-9]+)_fkey/);
      const fieldName = match ? match[1] : rawField;

      return errorResponse(
        set,
        400,
        { key: "common.badRequest", params: { field: fieldName } },
        null,
        locale,
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[])?.join(", ") || "field";
      return errorResponse(
        set,
        409,
        { key: "common.error", params: { field: target } },
        null,
        locale,
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return errorResponse(set, 404, { key: "common.notFound" }, null, locale);
    }

    return;
  });

export const materials = createBaseApp({ tags: ["Materials"] }).group(
  "/materials",
  (app) => app.use(protectedMaterials),
);
