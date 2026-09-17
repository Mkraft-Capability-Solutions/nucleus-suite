export interface RoleProfile {
  role: string;
  email: string;
  name: string;
  employeeId: string | null;
  id: string;
  designation: string;
  dept: string;
  defaultConsole: string;
  avatar: string;
}

export const DEFAULT_ROLE_PROFILES: Record<string, RoleProfile> = {
  SUPER_ADMIN: {
    role: "SUPER_ADMIN",
    email: "superadmin@nucleus.com",
    name: "Superadmin",
    employeeId: null,
    id: "DEMO-SUPER_ADMIN",
    designation: "System Administrator",
    dept: "Platform",
    defaultConsole: "S1",
    avatar: "/images/favicon_io/android-chrome-192x192.png"
  },
  ADMIN: {
    role: "ADMIN",
    email: "admin@nucleus.com",
    name: "Admin",
    employeeId: null,
    id: "DEMO-ADMIN",
    designation: "Workspace Owner",
    dept: "Administration",
    defaultConsole: "S1",
    avatar: "/images/favicon_io/android-chrome-192x192.png"
  },
  HR_MANAGER: {
    role: "HR_MANAGER",
    email: "hr@nucleus.com",
    name: "Sunita Verma",
    employeeId: "MK-102",
    id: "MK-102",
    designation: "Head of HR",
    dept: "Human Resources",
    defaultConsole: "S2",
    avatar: "/images/favicon_io/android-chrome-192x192.png"
  },
  FINANCE_MANAGER: {
    role: "FINANCE_MANAGER",
    email: "payroll@nucleus.com",
    name: "Rahul Verma",
    employeeId: "MK-105",
    id: "MK-105",
    designation: "Head of Payroll & Finance",
    dept: "Finance",
    defaultConsole: "S5",
    avatar: "/images/favicon_io/android-chrome-192x192.png"
  },
  MANAGER: {
    role: "MANAGER",
    email: "manager@nucleus.com",
    name: "Ramesh Nair",
    employeeId: "MK-104",
    id: "MK-104",
    designation: "Weaving Supervisor",
    dept: "Weaving",
    defaultConsole: "S7",
    avatar: "/images/favicon_io/android-chrome-192x192.png"
  },
  EMPLOYEE: {
    role: "EMPLOYEE",
    email: "employee@nucleus.com",
    name: "Vikas Yadav",
    employeeId: "MK-107",
    id: "MK-107",
    designation: "Master Loom Technician",
    dept: "Weaving",
    defaultConsole: "S8",
    avatar: "/images/favicon_io/android-chrome-192x192.png"
  }
};
