# Preview role model

These five accounts follow the current Nucleus branding. The original image is superseded by this role model.

**Shared demo password (all five accounts): `Nucl3u$123$ecure`**

This password is documented at the user’s explicit request for synthetic preview access only. Never reuse it for production accounts. Server fixtures retain only unique salts and scrypt hashes.

| Role key | Login email | Persona | Default console |
| --- | --- | --- | --- |
| SUPER_ADMIN | superadmin@nucleus.com | System administrator; no employee linkage | S10 governance |
| ADMIN | admin@nucleus.com | Workspace owner; no employee linkage | S10 governance |
| HR_MANAGER | hr@nucleus.com | Sunita Verma, MK-102, Head of HR | S2 HR operations |
| MANAGER | manager@nucleus.com | Ramesh Nair, MK-104, Weaving Supervisor | S7 manager |
| EMPLOYEE | employee@nucleus.com | Vikas Yadav, MK-107, Master Loom Technician | S8 employee |

Superadmin can inspect all preview modules/consoles. Admin starts with settings, access-control and integration previews, without HR operational dashboards. HR Manager covers employee lifecycle, recruitment, attendance, performance and payroll previews. Manager covers team attendance, performance and leave workflows; no payroll-administration grant. Employee uses self-service previews. Legacy role constants remain for compatibility with older feature code but no longer have login accounts or persona-switch entries.

Identity profiles are in `src/data/ui/context.AuthContext.json`; server login records are in `src/data/demo-accounts.json`. Module/console visibility is currently defined in `src/context/AuthContext.js`, action permissions in `src/utils/permissions.js`, and menu defaults in UI JSON. Changes must keep these consistent; browser role tests are required. The access-control role list contains the five active roles.

## Limits and next-phase requirements

Employee IDs above identify the supplied personas. The legacy synthetic workbook has its own employee directory; these profile fields do not establish verified foreign-key relationships or employee-specific dataset isolation. Do not use real personnel data in this mode.

The screenshot lists RLS bypass, tenant management, audit logging, outbox delivery, payroll approval and other capabilities. They are product requirements, not proof of implementation. RLS bypass has **not** been implemented. Before production, implement server-side tenant and record authorization, separate platform/workspace grants, auditable privileged access, persistent sessions, lifecycle approval invariants and employee/team-scoped reads. Admin must not grant platform privileges or modify users outside its tenant. These requirements remain behind the user's backend-phase approval.

## Personal dashboards

Superadmin (S10), HR Manager (S2) and Employee (S8) have separate customizable dashboard presets. The widget catalogue in `src/data/ui/dashboard.widgets.json` requires both explicit role membership and a current module grant. Permission changes and imported/saved layouts are revalidated before rendering. Admin retains the governance console; Manager retains the manager cockpit.

Each account can save up to six named layouts per console on its current browser. Layouts store presentation settings only, keyed by email, role and console. They are not synced across devices. The shared demo password above is also used by the local browser test configuration; the old credential image and retired Prisma seeders are not login sources.
