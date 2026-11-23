import "server-only";

import type { Access } from "@/server/platform/access";
import { recomputeEmployeeAlerts } from "@/server/alerts/engine";

/**
 * Call after an employee's visa/work-permit dates, documents or date custom fields change.
 * Never fails the caller's write: the daily scan corrects any miss. Returns whether it ran.
 */
export async function onEmployeeAlertSourcesChanged(access: Access, employeeId: string): Promise<boolean> {
  try {
    await recomputeEmployeeAlerts(access, employeeId);
    return true;
  } catch {
    // Best effort by design (see above); the cron tick's daily scan re-evaluates the employee.
    return false;
  }
}
