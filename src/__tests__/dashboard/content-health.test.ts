import { describe, expect, it } from "bun:test";
import { DashboardService } from "../../modules/dashboard/service";
import pino from "pino";

describe("DashboardService - getContentHealth", () => {
  it("should return empty arrays for empty group", async () => {
    const log = pino({ level: "silent" });
    // @ts-ignore - getContentHealth doesn't exist yet
    const result = await DashboardService.getContentHealth("empty", log);
    expect(result.quizzes).toEqual([]);
    expect(result.materials).toEqual([]);
  });
});
