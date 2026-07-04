import { createProtectedApp } from "@/libs/base";
import { LecturerQuizService } from "./service";
import {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
} from "./schema";
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
  .patch(
    "/quizzes/:quizId",
    async ({ set, params, body, log, locale }) => {
      const result = await LecturerQuizService.updateQuiz(
        params.quizId,
        body,
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
      body: updateQuizSchema,
      response: { 200: LecturerQuizModel.createResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .post(
    "/quizzes/:quizId/questions",
    async ({ set, params, body, log, locale }) => {
      const result = await LecturerQuizService.createQuestion(
        params.quizId,
        body,
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
      body: createQuestionSchema,
      response: { 201: LecturerQuizModel.createQuestionResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
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
