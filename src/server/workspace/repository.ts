import 'server-only';
import { workspaceResources } from './manifest';
import { pool } from '@/lib/db';

/**
 * Serves workspace data dynamically.
 * In JSON mode: returns canonical UI manifest.
 * In Database mode: aggregates live records from PostgreSQL tables (tenants, employees, departments, attendance, leaves, loans, payroll, learning).
 */
export async function getWorkspaceData() {
    const mode = process.env.APP_DATA_MODE || 'database';
    const liveResources = { ...workspaceResources };

    if (mode === 'json') {
        return { version: 1, resources: liveResources };
    }

    try {
        if (pool) {
            const [
                tenantRows,
                empRows,
                deptRows,
                posRows,
                leaveRows,
                leaveBalRows,
                attRows,
                loanRows,
                payrollRows,
                reqRows,
                announcementRows,
                courseRows,
                complianceRows,
                assetRows,
            ] = await Promise.all([
                pool.query('SELECT id, name, slug, status, legal_name, default_currency, timezone FROM tenants ORDER BY created_at ASC LIMIT 20').catch(() => ({ rows: [] })),
                pool.query('SELECT e.id, e.employee_code, e.first_name, e.last_name, e.work_email, e.designation, e.department, e.location, e.status, e.joining_date, e.basic_salary_minor, e.metadata FROM employees e ORDER BY e.employee_code ASC LIMIT 200').catch(() => ({ rows: [] })),
                pool.query('SELECT id, tenant_id, attributes FROM departments ORDER BY created_at ASC LIMIT 100').catch(() => ({ rows: [] })),
                pool.query('SELECT id, tenant_id, department_id, grade_id, attributes FROM positions ORDER BY created_at ASC LIMIT 100').catch(() => ({ rows: [] })),
                pool.query('SELECT id, employee_id, leave_type, status, starts_on, ends_on, requested_days, reason FROM leave_requests ORDER BY created_at DESC LIMIT 100').catch(() => ({ rows: [] })),
                pool.query('SELECT id, employee_id, leave_type, balance, as_of_date FROM leave_balances ORDER BY as_of_date DESC LIMIT 100').catch(() => ({ rows: [] })),
                pool.query('SELECT id, employee_id, attendance_date, assigned_shift, gross_span_minutes, productive_minutes, status FROM attendance_days ORDER BY attendance_date DESC LIMIT 200').catch(() => ({ rows: [] })),
                pool.query('SELECT id, employee_id, principal_minor, outstanding_minor, currency, status FROM loans ORDER BY created_at DESC LIMIT 50').catch(() => ({ rows: [] })),
                pool.query('SELECT id, period, scope, status, employee_count, gross_minor, deductions_minor, net_minor FROM payroll_runs ORDER BY created_at DESC LIMIT 50').catch(() => ({ rows: [] })),
                pool.query('SELECT id, department_id, hiring_manager_employee_id, attributes FROM requisitions ORDER BY created_at DESC LIMIT 50').catch(() => ({ rows: [] })),
                pool.query('SELECT id, attributes FROM feed_posts ORDER BY created_at DESC LIMIT 50').catch(() => ({ rows: [] })),
                pool.query('SELECT id, attributes FROM courses ORDER BY created_at ASC LIMIT 50').catch(() => ({ rows: [] })),
                pool.query('SELECT id, legal_entity_id, attributes FROM compliance_calendar_items ORDER BY created_at ASC LIMIT 50').catch(() => ({ rows: [] })),
                pool.query('SELECT id, attributes FROM asset_catalog ORDER BY created_at ASC LIMIT 50').catch(() => ({ rows: [] })),
            ]);

            if (tenantRows?.rows?.length > 0 || empRows?.rows?.length > 0) {
                (liveResources as any)._liveDatabase = {
                    tenants: tenantRows?.rows || [],
                    employees: empRows?.rows || [],
                    departments: deptRows?.rows || [],
                    positions: posRows?.rows || [],
                    leaves: leaveRows?.rows || [],
                    leaveBalances: leaveBalRows?.rows || [],
                    attendance: attRows?.rows || [],
                    loans: loanRows?.rows || [],
                    payroll: payrollRows?.rows || [],
                    requisitions: reqRows?.rows || [],
                    announcements: announcementRows?.rows || [],
                    courses: courseRows?.rows || [],
                    compliance: complianceRows?.rows || [],
                    assets: assetRows?.rows || [],
                    mode: 'database',
                };
            }
        }
    } catch (error) {
        console.warn('Database aggregation fallback to canonical manifest:', error);
    }

    return { version: 1, resources: liveResources };
}
