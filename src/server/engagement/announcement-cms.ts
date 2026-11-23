import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { ANNOUNCEMENT_TYPES, AUDIENCE_RULE_MAX_LENGTH, assertPublishable, parseAudienceRule, resolveAudiencePreview } from "@/server/engagement/announcement-register";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Content CMS for announcements (CMSModal). Announcements are `feed_posts` rows carrying
 * `attributes.audience` (the marker `announcement-register` uses to tell them from social posts).
 * Reads need `employee.read`; publish, pin and archive need `employee.write` — the same scope the
 * existing publish path enforces. Archive is a soft delete (`record_status = 'archived'`) so the
 * audit trail and the register's history keep the row.
 */

const TYPE_CODES = ANNOUNCEMENT_TYPES.map((entry) => entry.code) as [string, ...string[]];

export const publishCmsAnnouncementSchema = z.object({
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(200),
  body: z.string().trim().min(1, "Write the announcement content.").max(5000),
  category: z.enum(TYPE_CODES, { message: "Choose an announcement type." }),
  audience: z
    .string()
    .trim()
    .min(1, "Choose an audience.")
    .max(AUDIENCE_RULE_MAX_LENGTH)
    .refine((rule) => parseAudienceRule(rule).ok, "The audience rule is not valid."),
  pinned: z.boolean().default(false),
  expiresAt: z.iso.date().optional(),
});

export const pinAnnouncementSchema = z.object({ pinned: z.boolean() });

export type PublishCmsAnnouncement = z.infer<typeof publishCmsAnnouncementSchema>;

export type CmsAnnouncement = {
  id: string;
  version: number;
  title: string;
  body: string;
  category: string;
  audience: string;
  pinned: boolean;
  authorName: string | null;
  createdAt: string;
  expiresAt: string | null;
};

type Row = { id: string; version: number | string | null; attributes: Record<string, unknown>; created_at: string | Date; first_name: string | null; last_name: string | null };

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

export function projectAnnouncement(row: Row): CmsAnnouncement {
  const a = row.attributes ?? {};
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return {
    id: row.id,
    version: Number(row.version ?? 1),
    title: text(a.title),
    body: text(a.body),
    category: text(a.category) || "general",
    audience: text(a.audience, "all"),
    pinned: a.pinned === true,
    authorName: name || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    expiresAt: text(a.expires_at) || null,
  };
}

/** Pinned first, then newest. */
export function sortAnnouncements(items: CmsAnnouncement[]): CmsAnnouncement[] {
  return [...items].sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.createdAt.localeCompare(left.createdAt));
}

export async function listCmsAnnouncements(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.id, p.version, p.attributes, p.created_at, author.first_name, author.last_name
      from feed_posts p
        left join lateral (
          select e.first_name, e.last_name from memberships m
            join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
          where m.tenant_id = p.tenant_id and m.user_id::text = p.attributes->>'published_by'
          limit 1
        ) author on true
      where p.tenant_id = ${access.tenantId} and p.record_status = 'active' and p.attributes->>'audience' is not null
      order by p.created_at desc, p.id desc
      limit 100
    `,
  ]);
  return {
    items: sortAnnouncements((rows as Row[]).map(projectAnnouncement)),
    canManage: authorize(access.context, { action: "employee.write", resource: { tenantId: access.tenantId } }).allowed,
  };
}

const audit = (access: Access, action: string, id: string, reason: string, after: unknown, requestId: string) => sqlClient`
  insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
  values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
    ${action}, 'feed_post', ${id}, ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`;

export async function publishCmsAnnouncement(access: Access, input: PublishCmsAnnouncement, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (input.expiresAt && input.expiresAt < new Date().toISOString().slice(0, 10)) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The expiry date cannot be in the past.", details: [{ field: "expiresAt", issue: "past" }] });
  }
  const preview = await resolveAudiencePreview(access, input.audience);
  assertPublishable(preview);
  const id = crypto.randomUUID();
  const attributes = {
    title: input.title,
    body: input.body,
    audience: preview.rule || input.audience,
    category: input.category,
    pinned: input.pinned,
    kind: "management",
    expires_at: input.expiresAt ?? null,
    published_by: access.context.actorUserId,
    published_at: new Date().toISOString(),
  };
  await tenantTx(access, [
    sqlClient`insert into feed_posts (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify(attributes)}::jsonb)`,
    audit(access, "engage.announce", id, "Announcement published", { title: input.title, audience: attributes.audience, category: input.category, pinned: input.pinned }, requestId),
  ]);
  return { id, audienceCount: preview.resolvedCount };
}

async function requireAnnouncement(access: Access, id: string): Promise<Row> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, version, attributes, created_at, null::text as first_name, null::text as last_name from feed_posts
      where tenant_id = ${access.tenantId} and id = ${id} and record_status = 'active' and attributes->>'audience' is not null
      limit 1
    `,
  ]);
  const row = (rows as Row[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The announcement was not found." });
  return row;
}

export async function setAnnouncementPinned(access: Access, id: string, pinned: boolean, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await requireAnnouncement(access, id);
  await tenantTx(access, [
    sqlClient`
      update feed_posts set attributes = attributes || ${JSON.stringify({ pinned })}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    audit(access, pinned ? "engage.announce_pin" : "engage.announce_unpin", id, pinned ? "Announcement pinned" : "Announcement unpinned", { pinned }, requestId),
  ]);
  return { id, pinned };
}

export async function archiveAnnouncement(access: Access, id: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await requireAnnouncement(access, id);
  await tenantTx(access, [
    sqlClient`
      update feed_posts set record_status = 'archived', version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    audit(access, "engage.announce_archive", id, "Announcement removed from the feed", {}, requestId),
  ]);
  return { id, archived: true };
}
