"use client";

import { selectData, useApiResource } from "@/hooks/useApiResource";

/** Signed-in person's own profile (GET /api/v1/operations/profile, identity from the session only). */
export type OwnProfile = { id: string; employeeId: string | null; employeeCode: string | null; name: string | null; firstName: string | null; email: string | null; jobTitle: string | null; dept: string | null; location: string | null; photoUrl: string | null; roles: string[] };

export function useOwnProfile() {
  return useApiResource<OwnProfile>("/api/v1/operations/profile", selectData);
}
