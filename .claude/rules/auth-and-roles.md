# Rule: Auth, Roles & Access Control

## 5 Demo Roles

| Role Key | Email | Console | Access Scope |
|:---|:---|:---:|:---|
| `SUPER_ADMIN` | superadmin@nucleus.com | S10 | Full platform + all modules |
| `ADMIN` | admin@nucleus.com | S10 | Settings, access control, integrations |
| `HR_MANAGER` | hr@nucleus.com | S2 | Full HR ops — people, leave, payroll, recruitment |
| `MANAGER` | manager@nucleus.com | S7 | Team attendance, performance, leave approval |
| `EMPLOYEE` | employee@nucleus.com | S8 | Self-service — own profile, leave, payslip |

**Demo password (local prototype only):** `Nucl3u$123$ecure` — **never copy to production, env files, or logs**

## RBAC Check Pattern

```js
// ✅ Check permissions via utility
import { isModuleAllowed } from '@/utils/permissions';
if (!isModuleAllowed('payroll', userRole, userId)) return null;

// ✅ Use RoleProtected boundary component
<RoleProtected allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} moduleKey="payroll">
  <PayrollView />
</RoleProtected>
```

## Client-Side Role Checks = UI Convenience ONLY

**Client-side role gating is for UI display only — it is NOT a security boundary.**

Never describe a hidden button or conditional render as "secure" or "authorization". Real authorization happens at the server boundary (deferred to production phase).

## Console Access by Role

```js
// src/context/AuthContext.js — getPermittedConsoles()
SUPER_ADMIN: all consoles S1-S10
ADMIN:       S10 only
HR_MANAGER:  S1, S2, S3, S4, S5, S6, S9
MANAGER:     S7
EMPLOYEE:    S8
```

## Module Access by Role

Configure in `src/utils/permissions.js` — `isModuleAllowed(moduleKey, role, userId)`.

Do not gate modules inline in view components with `if (role === 'HR_MANAGER')`. Use the permission utility.

## Persona Identity

Synthetic personas for preview:
- `MK-102` — HR Manager (Sunita Verma)
- `MK-104` — Manager (Ramesh Nair)
- `MK-107` — Employee (Vikas Yadav)

These IDs are scoped to leave preview data. They are **not** verified foreign keys in a production database. Do not use them as universal employee IDs across modules.

## Session Model

Authentication is prototype-only via `src/app/api/auth/login/route.js`. It validates the demo password against server-held scrypt hashes and establishes an in-memory session. A browser reload ends the session (no persistence). This is intentional for the prototype phase.
