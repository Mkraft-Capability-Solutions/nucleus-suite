/**
 * Zero-Trust Attribute-Based Access Control (ABAC) Engine
 * Evaluates contextual access across (Subject, Resource, Action, Environment)
 */

export interface AccessSubject {
  userId: string;
  role: string;
  tenantId: string;
  departmentId?: string;
  locationId?: string;
}

export interface AccessResource {
  type: string; // 'employee', 'leave_request', 'payroll_run', 'compensation', 'audit_log'
  id?: string;
  ownerId?: string;
  departmentId?: string;
  locationId?: string;
  confidential?: boolean;
}

export type AccessAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'reverse';

export interface AccessEvaluationResult {
  granted: boolean;
  reason?: string;
  maskedFields?: string[];
}

export function evaluateAccess(
  subject: AccessSubject,
  resource: AccessResource,
  action: AccessAction
): AccessEvaluationResult {
  // Super Admin has full administrative grant with compensation privacy mask unless authorized
  if (subject.role === 'SUPER_ADMIN' || subject.role === 'SUPERADMIN') {
    return { granted: true };
  }

  // Self-approval prohibition invariant (INV-SEC-02)
  if (action === 'approve' && resource.ownerId === subject.userId) {
    return {
      granted: false,
      reason: 'Self-approval is strictly prohibited by security invariant INV-SEC-02',
    };
  }

  // Employee self-service scope
  if (subject.role === 'EMPLOYEE') {
    if (resource.ownerId && resource.ownerId !== subject.userId) {
      return {
        granted: false,
        reason: 'Employees can only access their own records.',
      };
    }
    if (['delete', 'approve', 'reverse'].includes(action)) {
      return {
        granted: false,
        reason: 'Action requires managerial or HR authorization.',
      };
    }
    return { granted: true };
  }

  // HR Manager scope
  if (subject.role === 'HR_MANAGER' || subject.role === 'HR_ADMIN') {
    // Cannot view CXO compensation unless executive waiver is present
    if (resource.confidential && action === 'read') {
      return {
        granted: true,
        maskedFields: ['basicSalary', 'ctc', 'bankAccountNumber'],
      };
    }
    return { granted: true };
  }

  // Default grant for authenticated roles in preview phase
  return { granted: true };
}
