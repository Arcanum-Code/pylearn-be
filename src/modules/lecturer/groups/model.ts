import { t } from "elysia";

export const LecturerGroupsModel = {
  studentsActivityQuery: t.Object({
    status: t.Optional(
      t.Union([
        t.Literal("ALL"),
        t.Literal("AT_RISK"),
        t.Literal("INACTIVE"),
        t.Literal("ON_TRACK"),
      ]),
    ),
    search: t.Optional(t.String()),
    sortBy: t.Optional(
      t.Union([
        t.Literal("name"),
        t.Literal("progress"),
        t.Literal("quiz_score"),
        t.Literal("last_active"),
      ]),
    ),
    sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  }),

  studentsActivityResponse: t.Object({
    error: t.Boolean(),
    code: t.Number(),
    message: t.String(),
    data: t.Object({
      summary: t.Object({
        total_students: t.Number(),
        at_risk_count: t.Number(),
        inactive_count: t.Number(),
        on_track_count: t.Number(),
        avg_class_progress: t.Number(),
        avg_class_quiz_score: t.Number(),
      }),
      columns: t.Object({
        materials: t.Array(
          t.Object({
            id: t.String(),
            title: t.String(),
            order: t.Number(),
          }),
        ),
        quizzes: t.Array(
          t.Object({
            id: t.String(),
            title: t.String(),
            level_number: t.Number(),
          }),
        ),
      }),
      students: t.Array(
        t.Object({
          student_id: t.String(),
          name: t.String(),
          email: t.String(),
          avatar_url: t.Union([t.String(), t.Null()]),
          status: t.String(),
          status_reasons: t.Array(t.String()),
          overall_progress_percentage: t.Number(),
          avg_quiz_score: t.Number(),
          last_active_at: t.Union([t.String(), t.Null()]),
          materials_progress: t.Array(
            t.Object({
              material_id: t.String(),
              status: t.String(),
              scroll_percentage: t.Number(),
              last_read_at: t.Union([t.String(), t.Null()]),
            }),
          ),
          quizzes_progress: t.Array(
            t.Object({
              quiz_id: t.String(),
              status: t.String(),
              best_score: t.Union([t.Number(), t.Null()]),
              attempts_count: t.Number(),
              last_attempt_at: t.Union([t.String(), t.Null()]),
            }),
          ),
        }),
      ),
    }),
  }),

  studentActivityDetailResponse: t.Object({
    error: t.Boolean(),
    code: t.Number(),
    message: t.String(),
    data: t.Object({
      student: t.Object({
        student_id: t.String(),
        name: t.String(),
        email: t.String(),
        enrolled_at: t.String(),
      }),
      quiz_attempts_history: t.Array(
        t.Object({
          attempt_id: t.String(),
          quiz_id: t.String(),
          quiz_title: t.String(),
          attempt_number: t.Number(),
          score: t.Union([t.Number(), t.Null()]),
          status: t.String(),
          started_at: t.String(),
          submitted_at: t.Union([t.String(), t.Null()]),
          time_spent_seconds: t.Union([t.Number(), t.Null()]),
          questions: t.Optional(
            t.Array(
              t.Object({
                question_id: t.String(),
                question_text: t.String(),
                question_type: t.Union([t.String(), t.Null()]),
                student_answer: t.Union([t.String(), t.Null()]),
                correct_answer: t.Union([t.String(), t.Null()]),
                is_correct: t.Boolean(),
                points_earned: t.Number(),
                points_possible: t.Number(),
                explanation: t.Union([t.String(), t.Null()]),
              }),
            ),
          ),
        }),
      ),
      material_reading_timeline: t.Array(
        t.Object({
          material_id: t.String(),
          material_title: t.String(),
          status: t.String(),
          scroll_percentage: t.Number(),
          first_opened_at: t.String(),
          completed_at: t.Union([t.String(), t.Null()]),
        }),
      ),
    }),
  }),
};
