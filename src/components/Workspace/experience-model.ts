/** Client shapes for the experience screen (mirrors src/server/engagement/experience.ts and recognition-feed.ts). */

export const EXP_NS = "components.Workspace.ExperienceView";

export type Loadable<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

export type CapabilityView = {
  employeeId: string;
  employeeName: string;
  run: {
    index: number;
    agrees: boolean;
    formula: string;
    permittedUse: string;
    computedAt: string;
    components: Array<{ key: string; label: string; value: number; weight: number; contribution: number }>;
  } | null;
};

export type WellbeingView = {
  self: { checkins: Array<{ id: string; energy: number | null; stress: number | null; workload: number | null; note: string | null; recordedAt: string }> } | null;
  aggregate: { cohortSize: number; threshold: number; suppressed: boolean; averages: { energy: number | null; stress: number | null; workload: number | null } | null };
  points: { configured: boolean; balance: number | null };
};

export type FeedPost = { id: string; title: string; body: string; kind: string; authorName: string; authorInitials: string; createdAt: string; reactionCount: number; commentCount: number };

export type Recognition = {
  id: string;
  message: string;
  points: number | null;
  recipient: { employeeId: string; name: string };
  nominator: { employeeId: string | null; name: string | null };
  createdAt: string;
  likeCount: number;
  likedByViewer: boolean;
};

export type EmployeeOption = { id: string; name: string };
