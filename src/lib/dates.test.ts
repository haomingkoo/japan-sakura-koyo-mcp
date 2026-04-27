import { describe, expect, it } from "vitest";
import {
  daysFromTodayJst,
  formatMonthDayJst,
  isoDateInJst,
  parseDateRangeInputJst,
} from "./dates.js";

describe("Japan date helpers", () => {
  it("formats instants using Japan calendar dates", () => {
    expect(isoDateInJst("2026-04-26T23:30:00Z")).toBe("2026-04-27");
    expect(formatMonthDayJst("2026-04-26T23:30:00Z")).toBe("4/27");
  });

  it("computes relative days against today's Japan date", () => {
    const now = new Date("2026-04-26T15:30:00Z"); // 2026-04-27 in Japan

    expect(daysFromTodayJst("2026-04-27T00:00:00+09:00", now)).toBe(0);
    expect(daysFromTodayJst("2026-04-28T00:00:00+09:00", now)).toBe(1);
    expect(daysFromTodayJst("2026-04-26T00:00:00+09:00", now)).toBe(-1);
  });

  it("validates date ranges once for API and MCP callers", () => {
    expect(parseDateRangeInputJst("2026-04-26", "2026-04-28")).toEqual({
      startDate: new Date("2026-04-26T00:00:00+09:00"),
      endDate: new Date("2026-04-28T00:00:00+09:00"),
    });
    expect(parseDateRangeInputJst("2026-04-28", "2026-04-26")).toBeNull();
    expect(parseDateRangeInputJst("bad", "2026-04-26")).toBeNull();
  });
});
