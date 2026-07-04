import { createProtectedApp } from "@/libs/base";
import { LecturerQuizService } from "./service";
import { createQuizSchema } from "./schema";
import { LecturerQuizModel } from "./model";
import { successResponse, errorResponse } from "@/libs/response";
import { hasPermission } from "@/middleware/permission";
import { LecturerQuizError } from "./error";

const FEATURE_NAME = "lecturer_quiz_access";

export const lecturerQuiz = createProtectedApp({ tags: ["Lecturer Quiz"] })
  .post(
    "/groups/:groupId/quizzes",
    async ({ set, params, body, user, log, locale }) => {
      const result = await LecturerQuizService.createQuiz(
        params.groupId,
        body,
        user.id,
        log,
      );
      return successResponse(
        set,
        result,
        { key: "common.success" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: createQuizSchema,
      response: { 201: LecturerQuizModel.createResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "create"),
    },
  )
  .onError(({ error, set, locale }) => {
    if (error instanceof LecturerQuizError) {
      return errorResponse(
        set,
        error.status,
        { key: error.key },
        error.details,
        locale,
      );
    }
  });
