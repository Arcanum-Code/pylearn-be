import { StudentQuizService } from "./service";
import { StudentQuizModel } from "./model";
import {
  CreateQuizAttemptSchema,
  QuizAttemptParamSchema,
  GetQuizAttemptsQuerySchema,
  GetQuestionsQuerySchema,
  CreateBulkQuizAnswerSchema,
  CreateQuizAnswerSchema,
  UpdateQuizAnswerSchema,
  QuizAnswerParamSchema,
  GetQuizAnswersQuerySchema,
} from "./schema";
import { successResponse, errorResponse } from "@/libs/response";
import { createProtectedApp } from "@/libs/base";
import { Prisma } from "@generated/prisma";
import { hasPermission } from "@/middleware/permission";
import {
  QuizAttemptValidationError,
  QuizAttemptContextException,
} from "./error";

const FEATURE_NAME = "student_quiz_access";

const attemptRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, user, set, log, locale }) => {
      const attempts = await StudentQuizService.getAttempts(
        query.quizId ? BigInt(query.quizId) : undefined,
        user.id,
        log,
      );
      return successResponse(
        set,
        attempts,
        { key: "quizAttempt.listSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      query: GetQuizAttemptsQuerySchema,
      response: { 200: StudentQuizModel.attempts, 500: StudentQuizModel.error },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/:id",
    async ({ params, set, log, locale }) => {
      const attempt = await StudentQuizService.getAttempt(
        BigInt(params.id),
        log,
      );
      return successResponse(
        set,
        attempt,
        { key: "quizAttempt.getSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: QuizAttemptParamSchema,
      response: {
        200: StudentQuizModel.attempt,
        404: StudentQuizModel.error,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .post(
    "/",
    async ({ body, user, set, log, locale }) => {
      const attempt = await StudentQuizService.createAttempt(
        user.id,
        body,
        log,
      );
      return successResponse(
        set,
        attempt,
        { key: "quizAttempt.createSuccess" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: CreateQuizAttemptSchema,
      response: {
        201: StudentQuizModel.createAttemptResult,
        400: StudentQuizModel.validationError,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "create"),
    },
  )
  .patch(
    "/:id/submit",
    async ({ params, user, set, log, locale }) => {
      const attempt = await StudentQuizService.submitAttempt(
        BigInt(params.id),
        user.id,
        log,
      );
      return successResponse(
        set,
        attempt,
        { key: "quizAttempt.submitSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: QuizAttemptParamSchema,
      response: {
        200: StudentQuizModel.submitAttemptResult,
        404: StudentQuizModel.error,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .get(
    "/status/me",
    async ({ query, user, set, log, locale }) => {
      const progress = await StudentQuizService.getProgress(
        BigInt(query.quizId),
        user.id,
        log,
      );
      return successResponse(
        set,
        progress,
        { key: "quizAttempt.progressSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      query: GetQuestionsQuerySchema,
      response: {
        200: StudentQuizModel.quizProgress,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/results",
    async ({ query, set, log, locale }) => {
      const results = await StudentQuizService.getAllAttemptsResults(
        query,
        log,
      );
      return successResponse(
        set,
        results,
        { key: "quizAttempt.bulkResultsSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      query: GetQuizAttemptsQuerySchema,
      response: {
        200: StudentQuizModel.quizAllAttemptResult,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .get(
    "/:id/results",
    async ({ params, user, set, log, locale }) => {
      const results = await StudentQuizService.getAttemptResults(
        params.id,
        user,
        log,
      );
      return successResponse(
        set,
        results,
        { key: "quizAttempt.resultsSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: QuizAttemptParamSchema,
      response: {
        200: StudentQuizModel.quizAttemptResult,
        400: StudentQuizModel.error,
        404: StudentQuizModel.error,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  );

const questionRoutes = createProtectedApp().get(
  "/attempt",
  async ({ query, set, log, locale }) => {
    const questions = await StudentQuizService.getStudentQuestions(
      BigInt(query.quizId),
      log,
    );
    return successResponse(
      set,
      questions,
      { key: "quiz.questionListSuccess" },
      200,
      undefined,
      locale,
    );
  },
  {
    query: GetQuestionsQuerySchema,
    response: {
      200: StudentQuizModel.questionsWithoutAnswer,
      500: StudentQuizModel.error,
    },
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
  },
);

const answerRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const answers = await StudentQuizService.getAnswers(
        BigInt(query.quizAttemptId),
        log,
      );
      return successResponse(
        set,
        answers,
        { key: "quizAnswer.listSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      query: GetQuizAnswersQuerySchema,
      response: { 200: StudentQuizModel.answers, 500: StudentQuizModel.error },
      beforeHandle: hasPermission(FEATURE_NAME, "read"),
    },
  )
  .post(
    "/",
    async ({ body, set, log, locale }) => {
      const answer = await StudentQuizService.createAnswer(body, log);
      return successResponse(
        set,
        answer,
        { key: "quizAnswer.createSuccess" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: CreateQuizAnswerSchema,
      response: {
        201: StudentQuizModel.createAnswerResult,
        400: StudentQuizModel.validationError,
        404: StudentQuizModel.error,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "create"),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, locale }) => {
      const answer = await StudentQuizService.updateAnswer(
        BigInt(params.id),
        body,
        log,
      );
      return successResponse(
        set,
        answer,
        { key: "quizAnswer.updateSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      params: QuizAnswerParamSchema,
      body: UpdateQuizAnswerSchema,
      response: {
        200: StudentQuizModel.updateAnswerResult,
        400: StudentQuizModel.validationError,
        404: StudentQuizModel.error,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "update"),
    },
  )
  .post(
    "/bulk",
    async ({ body, user, set, log, locale }) => {
      const answers = await StudentQuizService.createBulkAnswers(
        body,
        user.id,
        log,
      );
      return successResponse(
        set,
        answers,
        { key: "quizAnswer.bulkCreateSuccess" },
        201,
        undefined,
        locale,
      );
    },
    {
      body: CreateBulkQuizAnswerSchema,
      response: {
        201: StudentQuizModel.createBulkAnswerResult,
        400: StudentQuizModel.validationError,
        404: StudentQuizModel.error,
        500: StudentQuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE_NAME, "create"),
    },
  );

export const studentQuiz = createProtectedApp({ tags: ["Student Quiz"] }).group(
  "/quizzes",
  (app) =>
    app
      .group("/attempts", (app) => app.use(attemptRoutes))
      .group("/questions", (app) => app.use(questionRoutes))
      .group("/answers", (app) => app.use(answerRoutes))
      .onError(({ error, set, locale }) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2025") {
            return errorResponse(
              set,
              404,
              { key: "common.notFound" },
              null,
              locale,
            );
          }
          if (error.code === "P2002") {
            return errorResponse(
              set,
              400,
              "Duplicate order/constraint violation",
              null,
              locale,
            );
          }
        }
        if (error instanceof QuizAttemptValidationError) {
          return errorResponse(set, 400, error.message, null, locale);
        }

        if (error instanceof QuizAttemptContextException) {
          return errorResponse(set, 403, error.message, null, locale);
        }

        console.log("ERROR: ", error);
        return errorResponse(
          set,
          500,
          { key: "common.internalServerError" },
          null,
          locale,
        );
      }),
);
