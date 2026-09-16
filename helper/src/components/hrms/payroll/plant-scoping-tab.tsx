"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJson, invalidateGetRequests } from "@/lib/client-api";
import { SectionHeading, StateBlock, StatTile, StatusPill, Surface } from "../page-primitives";
import { asRecord, currencyLabel, minutesLabel, str } from "../workforce/records";

/**
 * Plant location scoping — location-scoped salary visibility.
 *
 * The masking on this screen is NOT done here. `/api/v1/plant-scope` decides, per row and
 * per caller, whether the compensation columns are put in the response at all; a row a
 * caller may not price arrives with `payVisible: false`, no amounts, and a sentence saying
 * why. This component renders that answer and cannot widen it: there is nothing in the
 * payload to un-hide.
 *
 * The scope mechanism is the repository's RL-24 data scopes — grants configured per ROLE
 * CODE in Role & Data Scope Setup and resolved into `AuthorizationContext.dataScopes` —
 * not a role name this screen knows. Whatever the tenant called its roles is what the
 * viewer panel below reports.
 */

type ScopeGrant = {
  roleCode: string;
  dimension: string;
  dimensionLabel: string;
  values: string[];
  canViewSalaryStructure: boolean;
  canViewRateStructure: boolean;
};

type Viewer = {
  roleCodes: string[];
  grants: ScopeGrant[];
  holdsRatePermission: boolean;
  scopeConfigured: boolean;
  canPreviewOtherScopes: boolean;
  previewableRoleCodes: string[];
  previewRoleCode: string | null;
  statement: string;
};

type Row = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  category: string;
  attendanceLocation: string;
  payrollLocation: string;
  shift: string | null;
  workingDays: number;
  overtimeMinutes: number;
  currency: string;
  payVisible: boolean;
  basicMinor?: number | null;
  grossMinor?: number | null;
  netMinor?: number | null;
  maskReason: string | null;
};

type View = {
  location: string | null;
  period: string;
  locations: string[];
  periods: string[];
  rows: Row[];
  viewer: Viewer;
  totals: { employees: number; payVisible: number; payMasked: number };
};

const selectClass = "h-10 min-w-0 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground";

function categoryWord(category: string): string {
  return category.replace(/[_-]/g, " ").replace(/^./, (character) => character.toUpperCase());
}

/** A pay cell: the amount when the server sent one, an explicit withheld marker when it did not. */
function PayCell({ row, amount }: { row: Row; amount: number | null | undefined }) {
  if (!row.payVisible) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <EyeOff className="size-3.5 shrink-0" strokeWidth={2} />
        Withheld
      </span>
    );
  }
  if (amount === null || amount === undefined) {
    return <span className="text-[11px] text-muted-foreground">Not on record</span>;
  }
  return <span className="font-mono text-[13px] text-foreground tabular-nums">{currencyLabel(amount, row.currency)}</span>;
}

export function PlantScopingTab() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [period, setPeriod] = useState("");
  const [previewRole, setPreviewRole] = useState("");
  const [revision, setRevision] = useState(0);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (period) params.set("period", period);
    if (previewRole) params.set("previewRole", previewRole);
    const query = params.toString();
    return `/api/v1/plant-scope${query ? `?${query}` : ""}`;
  }, [location, period, previewRole]);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getJson(path);
        // `ok()` spreads the attributes straight into `data`.
        const payload = asRecord(asRecord(raw).data) as unknown as View;
        if (live) setView(payload);
      } catch (caught) {
        if (live) {
          setView(null);
          setError(caught instanceof Error ? caught.message : "The plant workforce could not be loaded.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [path, revision]);

  const viewer = view?.viewer ?? null;
  const rows = view?.rows ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <SectionHeading
        title="Plant location scoping"
        description="One plant's workforce with its operational columns, and compensation shown only where the viewer's data scope reaches."
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => {
              invalidateGetRequests();
              setRevision((current) => current + 1);
            }}
          >
            <RefreshCw className="mr-2 size-4" strokeWidth={2} />
            Refresh
          </Button>
        }
      />

      <Surface>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground">Plant / location</span>
            <select className={selectClass} value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="">Every location</option>
              {(view?.locations ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground">Period</span>
            <select className={selectClass} value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="">Current month{view ? ` (${view.period})` : ""}</option>
              {(view?.periods ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {viewer?.canPreviewOtherScopes && (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-wider text-muted-foreground">Preview another role&apos;s scope</span>
              <select className={selectClass} value={previewRole} onChange={(event) => setPreviewRole(event.target.value)}>
                <option value="">Your own scope</option>
                {viewer.previewableRoleCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {viewer?.canPreviewOtherScopes && (
          <p className="mt-3 text-[12px] leading-[19px] text-muted-foreground">
            A preview re-queries the endpoint as that role&apos;s configured data scope. The server authorises it — it needs the
            membership.manage permission — and intersects the previewed role&apos;s permissions with your own, so a preview can only
            ever show you less than you already see, never more.
          </p>
        )}
      </Surface>

      <Surface>
        <SectionHeading title="Your effective scope" description="What the server used to decide which pay figures it sent you." />
        {!viewer && <p className="text-[12px] text-muted-foreground">Loading the viewer&apos;s scope.</p>}
        {viewer && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={viewer.holdsRatePermission ? "success" : "warning"} dot>
                {viewer.holdsRatePermission ? "Holds payroll.rate.read" : "No payroll.rate.read"}
              </StatusPill>
              <StatusPill tone={viewer.scopeConfigured ? "info" : "neutral"} dot>
                {viewer.scopeConfigured ? `${viewer.grants.length} data scope grant${viewer.grants.length === 1 ? "" : "s"}` : "No data scope configured"}
              </StatusPill>
              {viewer.previewRoleCode && (
                <StatusPill tone="violet" dot>
                  Previewing {viewer.previewRoleCode}
                </StatusPill>
              )}
              {viewer.roleCodes.map((code) => (
                <StatusPill key={code} tone="neutral">
                  {code}
                </StatusPill>
              ))}
            </div>

            <p className="flex items-start gap-2 text-sm leading-[21px] text-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
              <span>{viewer.statement}</span>
            </p>

            {viewer.grants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" style={{ minWidth: 560 }}>
                  <caption className="sr-only">Data scope grants that apply to this viewer</caption>
                  <thead>
                    <tr className="text-[11px] text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Role</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Scoped on</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Covers</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Salary structure</th>
                      <th scope="col" className="py-2 font-medium">Rate structure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewer.grants.map((grant) => (
                      <tr key={`${grant.roleCode}:${grant.dimension}`} className="border-t border-border align-top">
                        <td className="py-2.5 pr-3 font-mono text-[12px] text-foreground">{grant.roleCode}</td>
                        <td className="py-2.5 pr-3 text-[12px] text-muted-foreground">{grant.dimensionLabel}</td>
                        <td className="py-2.5 pr-3 text-[12px] text-foreground">
                          {grant.values.length === 0 ? "Nothing — an empty scope covers no records" : grant.values.join(", ")}
                        </td>
                        <td className="py-2.5 pr-3 text-[12px] text-foreground">{grant.canViewSalaryStructure ? "Visible" : "Withheld"}</td>
                        <td className="py-2.5 text-[12px] text-foreground">{grant.canViewRateStructure ? "Visible" : "Withheld"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="flex items-start gap-2 text-[12px] leading-[19px] text-muted-foreground">
              <KeyRound className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              <span>
                Compensation needs two independent things: the payroll.rate.read permission, and a grant whose location values cover
                the row. Both are checked on the server before the amounts are read out of the database, so a withheld figure is
                absent from the network response — not hidden by this page.
              </span>
            </p>
          </div>
        )}
      </Surface>

      {error && (
        <Surface>
          <StateBlock tone="error" icon={AlertTriangle} title="The plant workforce could not be loaded" description={error} />
        </Surface>
      )}
      {!error && loading && !view && (
        <Surface>
          <StateBlock tone="loading" icon={RefreshCw} title="Loading the plant workforce" description="Reading attendance, overtime and payroll for this period." />
        </Surface>
      )}

      {view && (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label={view.location ? `Employees at ${view.location}` : "Employees across every location"}
              value={String(view.totals.employees)}
              hint={`Period ${view.period}`}
              icon={Users}
              tone="primary"
            />
            <StatTile
              label="Rows with compensation sent"
              value={String(view.totals.payVisible)}
              hint="Permission and data scope both allow these"
              icon={ShieldCheck}
              tone="success"
            />
            <StatTile
              label="Rows with compensation withheld"
              value={String(view.totals.payMasked)}
              hint="The server omitted the amounts entirely"
              icon={EyeOff}
              tone="warning"
            />
          </div>

          <Surface className="p-0">
            <div className="p-5 pb-0">
              <SectionHeading
                title={view.location ? `${view.location} workforce` : "Workforce across every location"}
                description="Operational columns are visible to anyone who may read the workforce. The pay columns arrive only for rows your scope covers."
              />
            </div>
            {rows.length === 0 ? (
              <div className="p-5 pt-0">
                <StateBlock
                  icon={Building2}
                  title="No employees on record for this selection"
                  description="Choose another location or period. Nothing is sampled on this screen."
                />
              </div>
            ) : (
              <div className="overflow-x-auto pb-5">
                <table className="w-full text-left text-sm" style={{ minWidth: 1040 }}>
                  <caption className="sr-only">
                    Location-scoped workforce with attendance, overtime and — where the viewer&apos;s data scope allows — pay
                  </caption>
                  <thead>
                    <tr className="text-[11px] text-muted-foreground">
                      <th scope="col" className="px-3 py-3 pl-5 font-medium">Code</th>
                      <th scope="col" className="px-3 py-3 font-medium">Employee</th>
                      <th scope="col" className="px-3 py-3 font-medium">Role / department</th>
                      <th scope="col" className="px-3 py-3 font-medium">Category</th>
                      <th scope="col" className="px-3 py-3 font-medium">Shift</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">OT</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Working days</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Basic</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Gross</th>
                      <th scope="col" className="px-3 py-3 pr-5 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} className="border-t border-border align-top">
                        <td className="px-3 py-3 pl-5 font-mono text-[12px] text-foreground">{row.employeeCode}</td>
                        <td className="px-3 py-3">
                          <p className="text-[13px] font-medium text-foreground">{row.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Works at {row.attendanceLocation} · paid from {row.payrollLocation}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-foreground">
                          {row.designation}
                          <span className="block text-[11px] text-muted-foreground">{row.department}</span>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-foreground">{categoryWord(row.category)}</td>
                        <td className="px-3 py-3 text-[12px] text-foreground">{row.shift ?? "Not rostered"}</td>
                        <td className="px-3 py-3 text-right font-mono text-[12px] text-foreground tabular-nums">
                          {minutesLabel(row.overtimeMinutes)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[12px] text-foreground tabular-nums">{row.workingDays}</td>
                        <td className="px-3 py-3 text-right">
                          <PayCell row={row} amount={row.basicMinor} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PayCell row={row} amount={row.grossMinor} />
                        </td>
                        <td className="px-3 py-3 pr-5 text-right">
                          <PayCell row={row} amount={row.netMinor} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          {view.totals.payMasked > 0 && (
            <Surface>
              <SectionHeading
                title="Why compensation was withheld"
                description="One sentence per distinct reason, taken from the server's own authorisation decision."
              />
              <ul className="space-y-2">
                {[...new Set(rows.filter((row) => !row.payVisible).map((row) => str(row.maskReason, "Not permitted.")))].map((reason) => (
                  <li key={reason} className="flex min-w-0 items-start gap-2 rounded-lg border border-border p-3">
                    <EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <span className="min-w-0 text-[12px] leading-[19px] text-foreground">{reason}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </>
      )}
    </div>
  );
}
