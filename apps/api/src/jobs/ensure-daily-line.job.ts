import { ensureTodayDailyLine } from "../modules/daily-line/daily-line.service.js";

export async function ensureDailyLine() {
  return ensureTodayDailyLine();
}
