import { DashboardService } from "./service";
import { DashboardModel } from "./model";
import {
  DashboardParamSchema,
  CalendarQuerySchema,
  RecentActivityQuerySchema,
} from "./schema";
import { errorResponse, successResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";

const protectedDashboard = createProtectedApp()
  .get(
    "/",
    async ({ set, log, locale }) => {
      const dashboard = await DashboardService.getDashboard(log);
      return successResponse(
        set,
        dashboard,
        { key: "dashboard.dashboardSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      response: {
        200: DashboardModel.dashboard,
        500: DashboardModel.error,
      },
    },
  )
  .get(
    "/dosen",
    async ({ set, log, locale }) => {
      const dashboard = await DashboardService.getLecturerDashboard(log);
      return successResponse(
        set,
        dashboard,
        { key: "dashboard.lecturerDashboardSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      response: {
        200: DashboardModel.lecturerDashboard,
        500: DashboardModel.error,
      },
    },
  )
  .get(
    "/mahasiswa",
    async ({ user, set, log, locale }) => {
      const dashboard = await DashboardService.getStudentDashboard(
        user.id,
        log,
      );
      return successResponse(
        set,
        dashboard,
        { key: "dashboard.studentDashboardSuccess" },
        200,
        undefined,
        locale,
      );
    },
    {
      response: {
        200: DashboardModel.studentDashboard,
        500: DashboardModel.error,
      },
    },
  )
  .onError(({ error, set }) => {
    console.log("ERROR: ", error);
    return errorResponse(set, 500, { key: "common.internalServerError" }, null);
  });

const protectedLecturerDashboard = createProtectedApp()
  .get(
    "/calendar/events",
    async ({ query: { year, month, groupId }, set, log, locale }) => {
      const data = await DashboardService.getCalendarEvents(
        year,
        month,
        groupId,
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
      query: CalendarQuerySchema,
      response: {
        200: DashboardModel.calendarEvents,
        500: DashboardModel.error,
      },
      beforeHandle: hasPermission("group_management", "read"),
    },
  )
  .get(
    "/dashboard/recent-activity",
    async ({ query: { limit, groupId }, set, log, locale }) => {
      const data = await DashboardService.getRecentActivity(
        limit,
        groupId,
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
      query: RecentActivityQuerySchema,
      response: {
        200: DashboardModel.recentActivity,
        500: DashboardModel.error,
      },
      beforeHandle: hasPermission("group_management", "read"),
    },
  )
  .group("/groups/:groupId/dashboard", (app) =>
    app
      .get(
        "/summary",
        async ({ params: { groupId }, set, log, locale }) => {
          const data = await DashboardService.getSummary(groupId, log);
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
          params: DashboardParamSchema,
          response: {
            200: DashboardModel.summary,
            500: DashboardModel.error,
          },
          beforeHandle: hasPermission("group_management", "read"),
        },
      )
      .get(
        "/content-health",
        async ({ params: { groupId }, set, log, locale }) => {
          const data = await DashboardService.getContentHealth(groupId, log);
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
          params: DashboardParamSchema,
          response: {
            200: DashboardModel.contentHealth,
            500: DashboardModel.error,
          },
          beforeHandle: hasPermission("group_management", "read"),
        },
      ),
  )
  .onError(({ error, set }) => {
    console.log("LECTURER DASHBOARD ERROR: ", error);
    return errorResponse(set, 500, { key: "common.internalServerError" }, null);
  });

export const dashboard = createBaseApp({ tags: ["Dashboard"] })
  .group("/dashboard", (app) => app.use(protectedDashboard))
  .group("/lecturer", (app) => app.use(protectedLecturerDashboard));
