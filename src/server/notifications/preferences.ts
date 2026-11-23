import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/** Read side of notification_preferences for the caller's own membership. */

export type NotificationPreferences = {
  stored: boolean;
  channels: { inapp: boolean; email: boolean; sms: boolean };
  mutedEvents: string[];
};

export async function getOwnPreferences(access: Access): Promise<NotificationPreferences> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from notification_preferences where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId} limit 1`,
  ]);
  const attributes = (rows as Array<{ attributes: { channels?: Record<string, unknown>; muted_events?: unknown } }>)[0]?.attributes;
  const channels = attributes?.channels ?? {};
  return {
    stored: Boolean(attributes),
    // Defaults mirror upsertPreferencesSchema: in-app on, email and SMS off until chosen.
    channels: {
      inapp: typeof channels.inapp === "boolean" ? channels.inapp : true,
      email: typeof channels.email === "boolean" ? channels.email : false,
      sms: typeof channels.sms === "boolean" ? channels.sms : false,
    },
    mutedEvents: Array.isArray(attributes?.muted_events) ? attributes.muted_events.filter((event): event is string => typeof event === "string") : [],
  };
}
