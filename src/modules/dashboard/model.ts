import { z } from "zod";
import { createErrorSchema, createResponseSchema } from "@/libs/response";

// Original Dashboard schemas
const RoleDistributionItem = z.object({
  roleName: z.string(),
  count: z.number(),
});

const DashboardData = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  inactiveUsers: z.number(),
  totalRoles: z.number(),
  totalFeatures: z.number(),
  userDistribution: z.array(RoleDistributionItem),
});

const LecturerOverviewSchema = z.object({
  totalMaterials: z.number().int().nonnegative(),
  totalQuizzes: z.number().int().nonnegative(),
  totalStudentAttempts: z.number().int().nonnegative(),
});

const MaterialBreakdownItemSchema = z.object({
  materialId: z.string(),
  title: z.string(),
  materialType: z.string(),
  quizCount: z.number().int().nonnegative(),
  levelCount: z.number().int().nonnegative(),
  uniqueStudentsEngaged: z.number().int().nonnegative(),
});

const GroupsOverviewItemSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  totalStudents: z.number().int().nonnegative(),
  avgPassRate: z.number().nonnegative(),
  totalStudentAttempts: z.number().int().nonnegative(),
});

export const LecturerDashboardSchema = z.object({
  overview: LecturerOverviewSchema,
  groupsOverview: z.array(GroupsOverviewItemSchema),
  materialBreakdown: z.array(MaterialBreakdownItemSchema),
});

const StudentOverviewSchema = z.object({
  totalAttempts: z.number().int().nonnegative(),
  quizzesCompleted: z.number().int().nonnegative(),
});

const InProgressAttemptItemSchema = z.object({
  attemptId: z.string(),
  quizId: z.string(),
  quizTitle: z.string(),
  startedAt: z.string().datetime(),
});

const RecentResultItemSchema = z.object({
  attemptId: z.string(),
  quizId: z.string(),
  quizTitle: z.string(),
  groupId: z.string(),
  submittedAt: z.string().datetime(),
});

const EnrolledGroupMaterialSchema = z.object({
  materialId: z.string(),
  title: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  scrollPercentage: z.number().nullable(),
});

const EnrolledGroupSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  materialsCompleted: z.number().int().nonnegative(),
  materialsTotal: z.number().int().nonnegative(),
  materials: z.array(EnrolledGroupMaterialSchema),
});

export const StudentDashboardSchema = z.object({
  overview: StudentOverviewSchema,
  inProgress: z.array(InProgressAttemptItemSchema),
  recentResults: z.array(RecentResultItemSchema),
  enrolledGroups: z.array(EnrolledGroupSchema),
});

// New Lecturer Dashboard schemas (Group and Quiz scoped)
const LecturerDashboardSummary = z.object({
  group_id: z.string(),
  total_students: z.number().int().nonnegative(),
  avg_materials_read: z.number(),
  total_materials: z.number().int().nonnegative(),
  avg_pass_rate: z.number(),
  pass_rate_trend: z.object({
    current_week: z.number(),
    previous_week: z.number(),
    delta: z.number(),
  }),
  generated_at: z.string().datetime(),
});

const ContentHealthQuizItem = z.object({
  quiz_id: z.string(),
  level: z.number().int(),
  title: z.string(),
  first_attempt_pass_rate: z.number(),
  avg_attempts_to_pass: z.number(),
  flag: z.string().nullable().optional(),
});

const ContentHealthMaterialItem = z.object({
  material_id: z.string(),
  title: z.string(),
  read_rate: z.number(),
  flag: z.string().nullable().optional(),
});

const LecturerDashboardContentHealth = z.object({
  quizzes: z.array(ContentHealthQuizItem),
  materials: z.array(ContentHealthMaterialItem),
});

const BlankStatItem = z.object({
  blank_id: z.string(),
  keyword: z.string(),
  miss_rate: z.number(),
});

const QuestionBlankStat = z.object({
  question_id: z.string(),
  blanks: z.array(BlankStatItem),
});

const LecturerDashboardBlankStats = z.object({
  quiz_id: z.string(),
  questions: z.array(QuestionBlankStat),
});

const NeedsAttentionStudentItem = z.object({
  student_id: z.string(),
  name: z.string(),
  reason: z.enum(["stuck", "inactive", "slow_progress"]),
  detail: z.string(),
  last_activity_days_ago: z.number().int().nonnegative().nullable(),
});

const LecturerDashboardNeedsAttention = z.object({
  students: z.array(NeedsAttentionStudentItem),
});

const StudentLevelScore = z.object({
  level: z.number().int(),
  score: z.number().nullable(),
  status: z.enum(["passed", "failed", "locked"]),
});

const StudentTableItem = z.object({
  student_id: z.string(),
  name: z.string(),
  materials_read: z.number().int(),
  materials_total: z.number().int(),
  level_scores: z.array(StudentLevelScore),
  last_activity_at: z.string().datetime().nullable(),
  status: z.enum(["on_track", "stuck", "inactive"]),
});

const LecturerDashboardStudentTable = z.object({
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  students: z.array(StudentTableItem),
});

const StudentDrilldownMaterial = z.object({
  material_id: z.string(),
  title: z.string(),
  read_at: z.string().datetime().nullable(),
});

const StudentDrilldownBlankResult = z.object({
  blank_id: z.string(),
  correct: z.boolean(),
});

const StudentDrilldownAnswer = z.object({
  question_id: z.string(),
  blank_results: z.array(StudentDrilldownBlankResult),
});

const StudentDrilldownQuizAttempt = z.object({
  quiz_id: z.string(),
  level: z.number().int(),
  attempt_number: z.number().int(),
  score: z.number().nullable(),
  status: z.enum(["passed", "failed"]),
  submitted_at: z.string().datetime().nullable(),
  answers: z.array(StudentDrilldownAnswer),
});

const LecturerDashboardStudentActivity = z.object({
  student_id: z.string(),
  materials: z.array(StudentDrilldownMaterial),
  quiz_attempts: z.array(StudentDrilldownQuizAttempt),
});

const CalendarEventItem = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:mm
  type: z.enum(["quiz_open", "quiz_close", "material_release"]),
  title: z.string(),
  targetId: z.string(),
  groupId: z.string(),
});

const RecentActivityItem = z.object({
  id: z.string(),
  studentName: z.string(),
  taskName: z.string(),
  submittedAt: z.string().datetime(),
  score: z.number(),
  groupId: z.string(),
});

export const DashboardModel = {
  dashboard: createResponseSchema(DashboardData),
  lecturerDashboard: createResponseSchema(LecturerDashboardSchema),
  studentDashboard: createResponseSchema(StudentDashboardSchema),

  // New Lecturer Dashboard models
  summary: createResponseSchema(LecturerDashboardSummary),
  contentHealth: createResponseSchema(LecturerDashboardContentHealth),
  blankStats: createResponseSchema(LecturerDashboardBlankStats),
  needsAttention: createResponseSchema(LecturerDashboardNeedsAttention),
  studentTable: createResponseSchema(LecturerDashboardStudentTable),
  studentActivity: createResponseSchema(LecturerDashboardStudentActivity),
  nudgeResult: createResponseSchema(z.object({ success: z.boolean() })),
  calendarEvents: createResponseSchema(z.array(CalendarEventItem)),
  recentActivity: createResponseSchema(z.array(RecentActivityItem)),

  error: createErrorSchema(z.null()),
};

export type DashboardData = z.infer<typeof DashboardData>;
export type StudentDashboardData = z.infer<typeof StudentDashboardSchema>;
export type LecturerDashboardData = z.infer<typeof LecturerDashboardSchema>;
