/** Pure helpers for the team directory built from GET /api/v1/people. */

export type PersonItem = {
  id: string;
  employeeCode: string;
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
};

export type Member = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  role: string | null;
  dept: string | null;
  location: string | null;
  shift: string | null;
  skills: string[];
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Maps a directory row; shift and skills come only from stored profile metadata. */
export function toMember(p: PersonItem): Member {
  const meta = p.metadata ?? {};
  const skills = Array.isArray(meta.skills) ? meta.skills.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
  return {
    id: p.id,
    code: p.employeeCode,
    name: [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || p.employeeCode,
    email: text(p.workEmail),
    role: text(p.designation),
    dept: text(p.department),
    location: text(p.location),
    shift: text(meta.shift) ?? text(meta.shiftName),
    skills,
  };
}

export const ALL_PODS = "all";

export function pods(members: Member[]): string[] {
  return [...new Set(members.map((m) => m.dept).filter((d): d is string => d !== null))].sort();
}

/** Client-side refinement on the loaded page: department pill plus skill match (name/role are searched server-side). */
export function filterMembers(members: Member[], pod: string, query: string): Member[] {
  const q = query.trim().toLowerCase();
  return members.filter((m) =>
    (pod === ALL_PODS || m.dept === pod)
    && (!q || [m.name, m.role, m.dept, m.code, ...m.skills].some((v) => (v ?? "").toLowerCase().includes(q))));
}
