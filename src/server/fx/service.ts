import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const quoteFxSchema = z.object({
  baseCode: z.string().regex(/^[A-Z]{3}$/),
  quoteCode: z.string().regex(/^[A-Z]{3}$/),
  rate: z.string().regex(/^\d+(\.\d+)?$/).refine((value) => Number(value) > 0, "Rates must be positive."),
  source: z.string().trim().min(1).max(80),
}).superRefine((value, context) => {
  if (value.baseCode === value.quoteCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Base and quote currencies must differ." });
  }
});

/** Convert integer minor units through a decimal-string rate with no float drift. */
export function convertMinor(amountMinor: number, rate: string): number {
  if (!Number.isInteger(amountMinor)) throw new Error("Amounts must be integer minor units.");
  const [whole, fraction = ""] = rate.split(".");
  const scale = 10 ** fraction.length;
  return Math.round((amountMinor * (Number(whole) * scale + Number(fraction || "0"))) / scale);
}

const KNOWN_CURRENCIES: Record<string, { name: string; symbol: string; minor: number }> = {
  INR: { name: "Indian Rupee", symbol: "₹", minor: 2 },
  USD: { name: "US Dollar", symbol: "$", minor: 2 },
  EUR: { name: "Euro", symbol: "€", minor: 2 },
  GBP: { name: "British Pound", symbol: "£", minor: 2 },
  AED: { name: "UAE Dirham", symbol: "د.إ", minor: 2 },
  SGD: { name: "Singapore Dollar", symbol: "S$", minor: 2 },
};

async function currencyId(code: string): Promise<string> {
  const rows = (await sqlClient`select id from currencies where alpha_code = ${code} and active = true limit 1`) as Array<{ id: string }>;
  if (rows[0]?.id) return rows[0].id;
  const known = KNOWN_CURRENCIES[code];
  if (!known) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Currency ${code} is not enabled.` });
  await sqlClient`insert into currencies (id, alpha_code, name, symbol, minor_units, active) values (${crypto.randomUUID()}, ${code}, ${known.name}, ${known.symbol}, ${known.minor}, true) on conflict do nothing`;
  const retry = (await sqlClient`select id from currencies where alpha_code = ${code} and active = true limit 1`) as Array<{ id: string }>;
  if (!retry[0]?.id) throw new HttpError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Currency bootstrap failed." });
  return retry[0].id;
}

export async function quoteFxRate(access: Access, input: z.infer<typeof quoteFxSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const baseId = await currencyId(input.baseCode);
  const quoteId = await currencyId(input.quoteCode);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into exchange_rate_snapshots (id, tenant_id, base_currency_id, quote_currency_id, attributes)
      values (${id}, ${access.tenantId}, ${baseId}, ${quoteId},
        ${JSON.stringify({ rate: input.rate, source: input.source, effective_at: new Date().toISOString() })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'fx.quote', 'exchange_rate_snapshot', ${id}, 'FX rate snapshot recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, pair: `${input.baseCode}/${input.quoteCode}`, rate: input.rate };
}

export async function latestFxRate(access: Access, baseCode: string, quoteCode: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.attributes, b.alpha_code as base, q.alpha_code as quote
      from exchange_rate_snapshots e
      join currencies b on b.id = e.base_currency_id
      join currencies q on q.id = e.quote_currency_id
      where e.tenant_id = ${access.tenantId} and b.alpha_code = ${baseCode} and q.alpha_code = ${quoteCode}
      order by e.created_at desc limit 1
    `,
  ]);
  const row = (rows as Array<{ attributes: { rate: string; source: string; effective_at: string }; base: string; quote: string }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "No rate snapshot exists for this pair." });
  return { pair: `${row.base}/${row.quote}`, ...row.attributes };
}

export async function convertFxQuote(access: Access, args: { baseCode: string; quoteCode: string; amountMinor: number }) {
  const latest = await latestFxRate(access, args.baseCode, args.quoteCode);
  return {
    pair: latest.pair,
    rate: latest.rate,
    source: latest.source,
    effectiveAt: latest.effective_at,
    baseMinor: args.amountMinor,
    quoteMinor: convertMinor(args.amountMinor, latest.rate),
  };
}
