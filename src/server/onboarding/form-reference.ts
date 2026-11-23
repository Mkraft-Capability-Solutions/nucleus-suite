import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Tenant master data the employee creation wizard (FRM-PPL-01) picks from: departments,
 * work locations and shift masters. One read so the form opens with a single round trip;
 * every list is tenant-scoped and capped. Nothing here is invented: an empty tenant gets
 * empty lists and the form says so.
 */

export type DepartmentOption = { name: string; code: string | null };
export type LocationOption = { code: string; name: string; city: string | null; state: string | null };
export type ShiftOption = { code: string; name: string; startsAt: string | null; endsAt: string | null; durationMinutes: number | null };

export type EmployeeFormReference = {
  departments: DepartmentOption[];
  locations: LocationOption[];
  shifts: ShiftOption[];
};

const LIST_CAP = 300;

type DepartmentRow = { name: string | null; code: string | null };
type LocationRow = { code: string | null; name: string | null; city: string | null; state: string | null };
type ShiftRow = { code: string | null; name: string | null; starts_at: string | null; ends_at: string | null; duration_minutes: string | number | null };

/** Departments come from the master, plus any name already carried on an employee row. */
export function mergeDepartments(master: DepartmentRow[], inUse: Array<{ name: string | null }>): DepartmentOption[] {
  const byName = new Map<string, DepartmentOption>();
  for (const row of master) {
    const name = (row.name ?? "").trim();
    if (name) byName.set(name.toLowerCase(), { name, code: row.code });
  }
  for (const row of inUse) {
    const name = (row.name ?? "").trim();
    if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { name, code: null });
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)).slice(0, LIST_CAP);
}

export async function loadEmployeeFormReference(access: Access): Promise<EmployeeFormReference> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [departmentRows, inUseRows, locationRows, shiftRows] = await tenantTx(access, [
    sqlClient`select attributes->>'name' as name, attributes->>'code' as code
      from departments where tenant_id = ${access.tenantId} and record_status <> 'archived'
      order by attributes->>'name' asc limit ${LIST_CAP}`,
    sqlClient`select distinct department as name from employees
      where tenant_id = ${access.tenantId} and department is not null limit ${LIST_CAP}`,
    sqlClient`select attributes->>'code' as code, attributes->>'name' as name,
        attributes->>'city' as city, attributes->>'state' as state
      from locations where tenant_id = ${access.tenantId} and record_status <> 'archived'
        and attributes->>'code' is not null
      order by attributes->>'code' asc limit ${LIST_CAP}`,
    sqlClient`select attributes->>'code' as code, attributes->>'name' as name,
        attributes->>'starts_at' as starts_at, attributes->>'ends_at' as ends_at,
        attributes->>'duration_minutes' as duration_minutes
      from shifts where tenant_id = ${access.tenantId} and record_status <> 'archived'
        and attributes->>'code' is not null
      order by attributes->>'code' asc limit ${LIST_CAP}`,
  ]);

  return {
    departments: mergeDepartments(departmentRows as DepartmentRow[], inUseRows as Array<{ name: string | null }>),
    locations: (locationRows as LocationRow[]).flatMap((row) =>
      row.code ? [{ code: row.code, name: row.name?.trim() || row.code, city: row.city, state: row.state }] : []),
    shifts: (shiftRows as ShiftRow[]).flatMap((row) => {
      if (!row.code) return [];
      const minutes = row.duration_minutes === null ? null : Number(row.duration_minutes);
      return [{
        code: row.code,
        name: row.name?.trim() || row.code,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        durationMinutes: minutes !== null && Number.isFinite(minutes) ? minutes : null,
      }];
    }),
  };
}
