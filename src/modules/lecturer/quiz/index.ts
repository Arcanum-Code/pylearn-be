import { createProtectedApp } from "@/libs/base";
import { LecturerQuizService } from "./service";
import {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  replaceBlanksSchema,
  updateQuestionSchema,
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
  .put(
    "/questions/:questionId/blanks",
    async ({ set, params, body, log, locale }) => {
      const result = await LecturerQuizService.replaceBlanks(
        params.questionId,
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
      body: replaceBlanksSchema,
      response: { 200: LecturerQuizModel.replaceBlanksResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .patch(
    "/questions/:questionId",
    async ({ set, params, body, log, locale }) => {
      const result = await LecturerQuizService.updateQuestion(
        params.questionId,
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
      body: updateQuestionSchema,
      response: { 200: LecturerQuizModel.updateQuestionResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .delete(
    "/questions/:questionId",
    async ({ set, params, log, locale }) => {
      await LecturerQuizService.deleteQuestion(params.questionId, log);
      return successResponse(
        set,
        null,
        { key: "common.success" },
        204,
        undefined,
        locale,
      );
    },
    {
      response: { 204: LecturerQuizModel.deleteQuestionResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "delete"),
    },
  )
  .post(
    "/quizzes/:quizId/publish",
    async ({ set, params, log, locale }) => {
      const result = await LecturerQuizService.publishQuiz(params.quizId, log);
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
      response: { 200: LecturerQuizModel.publishQuizResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .get(
    "/groups/:groupId/quizzes",
    async ({ set, params, log, locale }) => {
      const result = await LecturerQuizService.listQuizzes(params.groupId, log);
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
      response: { 200: LecturerQuizModel.listQuizzesResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/quizzes/:quizId",
    async ({ set, params, log, locale }) => {
      const result = await LecturerQuizService.getQuiz(params.quizId, log);
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
      response: { 200: LecturerQuizModel.getQuizResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .delete(
    "/quizzes/:quizId",
    async ({ set, params, log, locale }) => {
      await LecturerQuizService.deleteQuiz(params.quizId, log);
      return successResponse(
        set,
        null,
        { key: "common.success" },
        204,
        undefined,
        locale,
      );
    },
    {
      response: { 204: LecturerQuizModel.deleteQuizResponse },
      beforeHandle: hasPermission(FEATURE_NAME, "delete"),
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
