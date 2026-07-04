import {
  QuizService,
  QuizQuestionService,
  QuestionKeywordService,
  QuizAttemptService,
  QuizAnswerService,
} from "./service";
import { GetAllAttemptsResultsQuerySchema, QuizModel } from "./model";
import {
  CreateQuizSchema,
  UpdateQuizSchema,
  QuizParamSchema,
  CreateQuizQuestionSchema,
  UpdateQuizQuestionSchema,
  QuestionParamSchema,
  GetQuizzesQuerySchema,
  GetQuestionsQuerySchema,
  GetKeywordsQuerySchema,
  CreateKeywordSchema,
  UpdateKeywordSchema,
  KeywordParamSchema,
  GetQuizAttemptsQuerySchema,
  QuizAttemptParamSchema,
  CreateQuizAttemptSchema,
  GetQuizAnswersQuerySchema,
  CreateQuizAnswerSchema,
  QuizAnswerParamSchema,
  UpdateQuizAnswerSchema,
  CreateBulkQuizAnswerSchema,
} from "./schema";
import { successResponse, errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { Prisma } from "@generated/prisma";
import { hasPermission } from "@/middleware/permission";
import {
  InvalidTimeRangeError,
  CannotDeleteQuestionError,
  QuizAttemptValidationError,
  QuizAttemptContextException,
} from "./error";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const FEATURE = "quiz_management";

type ResponseContext = {
  set: Parameters<typeof successResponse>[0];
  locale: string;
};

/** Wraps a service call with a standard success response. */
function ok<T>(
  { set, locale }: ResponseContext,
  data: T,
  key: string,
  status: 200 | 201 = 200,
) {
  return successResponse(set, data, { key }, status, undefined, locale);
}

// ─────────────────────────────────────────────
// Route groups
// ─────────────────────────────────────────────

const quizRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const quizzes = await QuizService.getQuizzes(query.groupId, log);
      return ok({ set, locale }, quizzes, "quiz.listSuccess");
    },
    {
      query: GetQuizzesQuerySchema,
      response: { 200: QuizModel.quizzes, 500: QuizModel.error },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .get(
    "/:id",
    async ({ params, set, log, locale }) => {
      const quiz = await QuizService.getQuiz(BigInt(params.id), log);
      return ok({ set, locale }, quiz, "quiz.getSuccess");
    },
    {
      params: QuizParamSchema,
      response: {
        200: QuizModel.quiz,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .post(
    "/",
    async ({ body, set, log, locale }) => {
      const quiz = await QuizService.createQuiz(body, log);
      return ok({ set, locale }, quiz, "quiz.createSuccess", 201);
    },
    {
      body: CreateQuizSchema,
      response: {
        201: QuizModel.createResult,
        400: QuizModel.validationError,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "create"),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, locale }) => {
      const quiz = await QuizService.updateQuiz(BigInt(params.id), body, log);
      return ok({ set, locale }, quiz, "quiz.updateSuccess");
    },
    {
      params: QuizParamSchema,
      body: UpdateQuizSchema,
      response: {
        200: QuizModel.updateResult,
        400: QuizModel.validationError,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "update"),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, log, locale }) => {
      const result = await QuizService.deleteQuiz(BigInt(params.id), log);
      return ok({ set, locale }, result, "quiz.deleteSuccess");
    },
    {
      params: QuizParamSchema,
      response: {
        200: QuizModel.deleteResult,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "delete"),
    },
  );

const questionRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const questions = await QuizQuestionService.getQuestions(
        BigInt(query.quizId),
        log,
      );
      return ok({ set, locale }, questions, "quiz.questionListSuccess");
    },
    {
      query: GetQuestionsQuerySchema,
      response: { 200: QuizModel.questions, 500: QuizModel.error },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .post(
    "/",
    async ({ body, set, log, locale }) => {
      const question = await QuizQuestionService.createQuestion(body, log);
      return ok({ set, locale }, question, "quiz.questionCreateSuccess", 201);
    },
    {
      body: CreateQuizQuestionSchema,
      response: {
        201: QuizModel.createQuestionResult,
        400: QuizModel.validationError,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "create"),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, locale }) => {
      const question = await QuizQuestionService.updateQuestion(
        BigInt(params.id),
        body,
        log,
      );
      return ok({ set, locale }, question, "quiz.questionUpdateSuccess");
    },
    {
      params: QuestionParamSchema,
      body: UpdateQuizQuestionSchema,
      response: {
        200: QuizModel.updateQuestionResult,
        400: QuizModel.validationError,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "update"),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, log, locale }) => {
      const result = await QuizQuestionService.deleteQuestion(
        BigInt(params.id),
        log,
      );
      return ok({ set, locale }, result, "quiz.questionDeleteSuccess");
    },
    {
      params: QuestionParamSchema,
      response: {
        200: QuizModel.deleteQuestionResult,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "delete"),
    },
  )
  .get(
    "/attempt",
    async ({ query, set, log, locale }) => {
      const questions = await QuizQuestionService.getStudentQuestions(
        BigInt(query.quizId),
        log,
      );
      return ok({ set, locale }, questions, "quiz.questionListSuccess");
    },
    {
      query: GetQuestionsQuerySchema,
      response: {
        200: QuizModel.questionsWithoutAnswer,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  );

const keywordRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const keywords = await QuestionKeywordService.getKeywords(
        BigInt(query.questionId),
        log,
      );
      return ok({ set, locale }, keywords, "keyword.listSuccess");
    },
    {
      query: GetKeywordsQuerySchema,
      response: { 200: QuizModel.keywords, 500: QuizModel.error },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .post(
    "/",
    async ({ body, set, log, locale }) => {
      const keyword = await QuestionKeywordService.createKeyword(body, log);
      return ok({ set, locale }, keyword, "keyword.createSuccess", 201);
    },
    {
      body: CreateKeywordSchema,
      response: {
        201: QuizModel.keyword,
        400: QuizModel.validationError,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "create"),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, locale }) => {
      const keyword = await QuestionKeywordService.updateKeyword(
        BigInt(params.id),
        body,
        log,
      );
      return ok({ set, locale }, keyword, "keyword.updateSuccess");
    },
    {
      params: KeywordParamSchema,
      body: UpdateKeywordSchema,
      response: {
        200: QuizModel.keyword,
        400: QuizModel.validationError,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "update"),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, log, locale }) => {
      const result = await QuestionKeywordService.deleteKeyword(
        BigInt(params.id),
        log,
      );
      return ok({ set, locale }, result, "keyword.deleteSuccess");
    },
    {
      params: KeywordParamSchema,
      response: {
        200: QuizModel.deleteResult,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "delete"),
    },
  );

const attemptRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const attempts = await QuizAttemptService.getAttempts(
        query.quizId ? BigInt(query.quizId) : undefined,
        query.studentId,
        log,
      );
      return ok({ set, locale }, attempts, "quizAttempt.listSuccess");
    },
    {
      query: GetQuizAttemptsQuerySchema,
      response: { 200: QuizModel.attempts, 500: QuizModel.error },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .get(
    "/:id",
    async ({ params, set, log, locale }) => {
      const attempt = await QuizAttemptService.getAttempt(
        BigInt(params.id),
        log,
      );
      return ok({ set, locale }, attempt, "quizAttempt.getSuccess");
    },
    {
      params: QuizAttemptParamSchema,
      response: {
        200: QuizModel.attempt,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .post(
    "/",
    async ({ body, user, set, log, locale }) => {
      const attempt = await QuizAttemptService.createAttempt(
        user.id,
        body,
        log,
      );
      return ok({ set, locale }, attempt, "quizAttempt.createSuccess", 201);
    },
    {
      body: CreateQuizAttemptSchema,
      response: {
        201: QuizModel.createAttemptResult,
        400: QuizModel.validationError,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "create"),
    },
  )
  .patch(
    "/:id/submit",
    async ({ params, user, set, log, locale }) => {
      const attempt = await QuizAttemptService.submitAttempt(
        BigInt(params.id),
        user.id,
        log,
      );

      return ok({ set, locale }, attempt, "quizAttempt.submitSuccess");
    },
    {
      params: QuizAttemptParamSchema,
      response: {
        200: QuizModel.submitAttemptResult,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "update"),
    },
  )
  .get(
    "/status/me",
    async ({ query, user, set, log, locale }) => {
      const progress = await QuizAttemptService.getProgress(
        BigInt(query.quizId),
        user.id,
        log,
      );

      return ok({ set, locale }, progress, "quizAttempt.progressSuccess");
    },
    {
      query: GetQuestionsQuerySchema,
      response: {
        200: QuizModel.quizProgress,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .get(
    "/results",
    async ({ query, set, log, locale }) => {
      const results = await QuizAttemptService.getAllAttemptsResults(
        query,
        log,
      );

      return ok({ set, locale }, results, "quizAttempt.bulkResultsSuccess");
    },
    {
      query: GetAllAttemptsResultsQuerySchema,
      response: {
        200: QuizModel.quizAllAttemptResult,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .get(
    "/:id/results",
    async ({ params, user, set, log, locale }) => {
      const results = await QuizAttemptService.getAttemptResults(
        params.id,
        user,
        log,
      );

      return ok({ set, locale }, results, "quizAttempt.resultsSuccess");
    },
    {
      params: QuizAttemptParamSchema,
      response: {
        200: QuizModel.quizAttemptResult,
        400: QuizModel.error,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  );

const answerRoutes = createProtectedApp()
  .get(
    "/",
    async ({ query, set, log, locale }) => {
      const answers = await QuizAnswerService.getAnswers(
        BigInt(query.quizAttemptId),
        log,
      );
      return ok({ set, locale }, answers, "quizAnswer.listSuccess");
    },
    {
      query: GetQuizAnswersQuerySchema,
      response: { 200: QuizModel.answers, 500: QuizModel.error },
      beforeHandle: hasPermission(FEATURE, "read"),
    },
  )
  .post(
    "/",
    async ({ body, set, log, locale }) => {
      const answer = await QuizAnswerService.createAnswer(body, log);
      return ok({ set, locale }, answer, "quizAnswer.createSuccess", 201);
    },
    {
      body: CreateQuizAnswerSchema,
      response: {
        201: QuizModel.createAnswerResult,
        400: QuizModel.validationError,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "create"),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, locale }) => {
      const answer = await QuizAnswerService.updateAnswer(
        BigInt(params.id),
        body,
        log,
      );
      return ok({ set, locale }, answer, "quizAnswer.updateSuccess");
    },
    {
      params: QuizAnswerParamSchema,
      body: UpdateQuizAnswerSchema,
      response: {
        200: QuizModel.updateAnswerResult,
        400: QuizModel.validationError,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "update"),
    },
  )
  .post(
    "/bulk",
    async ({ body, user, set, log, locale }) => {
      const answers = await QuizAnswerService.createBulkAnswers(
        body,
        user.id,
        log,
      );
      return ok({ set, locale }, answers, "quizAnswer.bulkCreateSuccess", 201);
    },
    {
      body: CreateBulkQuizAnswerSchema,
      response: {
        201: QuizModel.createBulkAnswerResult,
        400: QuizModel.validationError,
        404: QuizModel.error,
        500: QuizModel.error,
      },
      beforeHandle: hasPermission(FEATURE, "create"),
    },
  );

// ─────────────────────────────────────────────
// App assembly
// ─────────────────────────────────────────────

export const quizzes = createBaseApp({ tags: ["Quizzes"] }).group(
  "/quizzes",
  (app) =>
    app
      .use(quizRoutes)
      .group("/questions", (app) => app.use(questionRoutes))
      .group("/keywords", (app) => app.use(keywordRoutes))
      .group("/attempts", (app) => app.use(attemptRoutes))
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
        if (
          error instanceof InvalidTimeRangeError ||
          error instanceof CannotDeleteQuestionError ||
          error instanceof QuizAttemptValidationError
        ) {
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
