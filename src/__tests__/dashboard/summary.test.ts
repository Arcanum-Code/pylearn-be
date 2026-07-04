import { describe, expect, it } from "bun:test";
import { DashboardService } from "../../modules/dashboard/service";
import pino from "pino";

describe("DashboardService - getSummary", () => {
  it("should return default summary when group has no data", async () => {
    const log = pino({ level: "silent" });
    // @ts-ignore - getSummary doesn't exist yet
    const result = await DashboardService.getSummary("dummy-group", log);
    expect(result.group_id).toBe("dummy-group");
    expect(result.total_students).toBe(0);
  });
});
