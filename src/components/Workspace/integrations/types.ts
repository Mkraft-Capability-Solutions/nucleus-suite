export type JobView = { id: string; status: string; attempts: number; requestedAt: string; publishedAt: string | null };
export type ConnectionView = {
  id: string; code: string | null; name: string | null; category: string | null; environment: string | null; status: string | null;
  createdAt: string; lastSync: JobView | null; lastTest: JobView | null; lastError: JobView | null;
};
export type IntegrationsOverview = {
  connections: ConnectionView[];
  eventBus: Record<"pending" | "leased" | "published" | "failed" | "dead", number>;
  webhooks: Array<{ id: string; host: string | null; events: string[]; status: string | null; createdAt: string }>;
  domains: Array<{ id: string; domain: string | null; status: string | null; verified: boolean }>;
};
export type ApiKeyView = {
  id: string; name: string; prefix: string; environment: string; scopes: string[];
  status: "active" | "revoked" | "expired"; expiresOn: string | null; createdAt: string;
};
