"use client";

import { picklistValues } from "@/lib/picklists";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CircleCheck,
  DoorOpen,
  Inbox,
  PackageCheck,
  Search,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import {
  DataTable,
  PageIntro,
  ProgressMeter,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
  TabPanel,
  TabStrip,
  type Column,
  type TabDefinition,
} from "../page-primitives";
import {
  asRecord,
  currencyLabel,
  dateLabel,
  listFromEnvelope,
  minutesLabel,
  monthStartISO,
  num,
  runTransition,
  statusTone,
  str,
  todayISO,
  useLive,
  useOperational,
  usePeople,
  type OperationalRecord,
} from "./records";
import { OperationCreateDialog } from "../operation-create-dialog";
import {
  gatePassAdmissible,
  gatePassAllowance,
  workforcePolicyDefaults,
} from "@/lib/workforce-policy";

/**
 * Assets & Gate Passes.
 *
 * The register and custody views read the catalog resource `assets`; the gate
 * pass ledger reads the typed `/api/v1/gate-passes` endpoint. Nothing on this
 * page is derived from sample data — every figure is computed from a response.
 */

const RESOURCE = "assets";

/** Mirrors the `assets` transitions declared in `src/lib/operational-catalog.ts`. */
const TRANSITIONS: Array<{ action: string; label: string; busyLabel: string; from: string[]; needsPanel: boolean }> = [
  { action: "allocate", label: "Allocate…", busyLabel: "Allocating…", from: ["available", "returned"], needsPanel: true },
  { action: "return", label: "Record return…", busyLabel: "Recording…", from: ["allocated"], needsPanel: true },
  { action: "repair", label: "Send to maintenance", busyLabel: "Sending…", from: ["returned", "available"], needsPanel: false },
  { action: "restore", label: "Restore to available", busyLabel: "Restoring…", from: ["maintenance"], needsPanel: false },
  { action: "retire", label: "Retire", busyLabel: "Retiring…", from: ["available", "returned", "maintenance"], needsPanel: false },
];

const RETURN_CONDITIONS = picklistValues("PL_ASSET_RETURN_CONDITION");

/**
 * The gate-pass API accepts a 120 or 240 minute pass (`requestGatePassSchema`).
 * The shorter duration is used only to report whether any further pass is still
 * admissible this month; the ceilings themselves come from workforce policy.
 */
const SHORTEST_PASS_MINUTES = 120;

const controlClass =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const actionButtonClass =
  "inline-flex h-10 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

type Notice = { tone: "ok" | "error"; message: string };
type PanelState = { id: string; action: "allocate" | "return" };

function textOr(value: unknown, fallback = "—"): string {
  return str(value, fallback);
}

export function AssetsPage() {
  const [tab, setTab] = useState("register");
  const assets = useOperational(RESOURCE);
  const { people, byId, nameOf } = usePeople();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [allocateTo, setAllocateTo] = useState("");
  const [returnCondition, setReturnCondition] = useState<string>(RETURN_CONDITIONS[0]);
  const [returnedOn, setReturnedOn] = useState(todayISO);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const rows = assets.rows;

  /**
   * `/api/v1/people` returns first/last name and code rather than a display
   * name, so `nameOf` is asked first and the directory row fills the gap.
   */
  const holderLabel = useCallback(
    (id: string) => {
      if (!id) return "No holder recorded";
      const resolved = nameOf(id, "");
      if (resolved) return resolved;
      const person = byId.get(id);
      if (!person) return "Holder outside the loaded directory";
      const composed = `${str(person.firstName)} ${str(person.lastName)}`.trim();
      return composed || str(person.employeeCode, "Unnamed employee");
    },
    [byId, nameOf],
  );

  const statuses = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) seen.add(row.status);
    return Array.from(seen).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return [row.assetTag, row.name, row.serialNumber].some((field) =>
        str(field).toLowerCase().includes(needle),
      );
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const tally = { total: rows.length, allocated: 0, available: 0, maintenance: 0 };
    for (const row of rows) {
      if (row.status === "allocated") tally.allocated += 1;
      else if (row.status === "available") tally.available += 1;
      else if (row.status === "maintenance") tally.maintenance += 1;
    }
    return tally;
  }, [rows]);

  const allocated = useMemo(() => rows.filter((row) => row.status === "allocated"), [rows]);

  const custody = useMemo(() => {
    const groups = new Map<string, OperationalRecord[]>();
    for (const row of allocated) {
      const holder = str(row.employeeId);
      const bucket = groups.get(holder);
      if (bucket) bucket.push(row);
      else groups.set(holder, [row]);
    }
    return Array.from(groups.entries())
      .map(([employeeId, held]) => ({ employeeId, name: holderLabel(employeeId), held }))
      .sort((a, b) => b.held.length - a.held.length || a.name.localeCompare(b.name));
  }, [allocated, holderLabel]);

  const panelAsset = useMemo(
    () => (panel ? rows.find((row) => row.id === panel.id) ?? null : null),
    [panel, rows],
  );

  function openPanel(next: PanelState) {
    setNotice(null);
    setPanel(next);
    setAllocateTo("");
    setReturnCondition(RETURN_CONDITIONS[0]);
    setReturnedOn(todayISO());
  }

  async function act(row: OperationalRecord, action: string, body: Record<string, unknown> = {}) {
    setBusy(`${row.id}:${action}`);
    setNotice(null);
    const result = await runTransition(RESOURCE, row.id, row.version, action, body);
    setNotice({ tone: result.ok ? "ok" : "error", message: result.message });
    if (result.ok) {
      setPanel(null);
      assets.refresh();
    }
    setBusy("");
  }

  const columns: Column<OperationalRecord>[] = [
    {
      key: "assetTag",
      header: "Asset tag",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-foreground tabular-nums">
          {textOr(row.assetTag)}
        </span>
      ),
    },
    {
      key: "name",
      header: "Asset",
      render: (row) => <span className="font-medium text-foreground">{textOr(row.name)}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <span className="text-muted-foreground">{str(row.category, "—").replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "serialNumber",
      header: "Serial number",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {textOr(row.serialNumber)}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (row) => <span className="text-muted-foreground">{textOr(row.location)}</span>,
    },
    {
      key: "condition",
      header: "Condition",
      render: (row) => <span className="text-muted-foreground">{textOr(row.condition)}</span>,
    },
    {
      key: "purchaseDate",
      header: "Purchased",
      render: (row) => (
        <span className="text-muted-foreground">{dateLabel(row.purchaseDate, "—")}</span>
      ),
    },
    {
      key: "purchaseCostMinor",
      header: "Purchase cost",
      align: "right",
      render: (row) => (
        <span className="font-mono text-xs text-foreground tabular-nums">
          {row.purchaseCostMinor === undefined || row.purchaseCostMinor === null
            ? "—"
            : currencyLabel(num(row.purchaseCostMinor))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const available = TRANSITIONS.filter((transition) => transition.from.includes(row.status));
        if (available.length === 0) {
          return <span className="text-xs text-muted-foreground">No action from this status</span>;
        }
        return (
          <div className="flex flex-wrap gap-2">
            {available.map((transition) => {
              const key = `${row.id}:${transition.action}`;
              const inFlight = busy === key;
              return (
                <button
                  key={transition.action}
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => {
                    if (transition.needsPanel) {
                      openPanel({ id: row.id, action: transition.action as PanelState["action"] });
                      return;
                    }
                    void act(row, transition.action);
                  }}
                  className={actionButtonClass}
                >
                  {inFlight ? transition.busyLabel : transition.label}
                </button>
              );
            })}
          </div>
        );
      },
    },
  ];

  const tabs: TabDefinition[] = [
    { id: "register", label: "Asset register", icon: Boxes, count: assets.loading ? undefined : rows.length },
    { id: "custody", label: "Custody & returns", icon: PackageCheck, count: assets.loading ? undefined : allocated.length },
    { id: "gatepasses", label: "Gate pass quota & ledger", icon: DoorOpen },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Workforce Operations"
        title="Assets & gate passes"
        description="Asset inventory with serial custody and returns, and the gate pass ledger measured against the monthly workforce policy."
        action={<OperationCreateDialog resource="assets" label="Add or edit an asset" onCreated={assets.refresh} />}
      />

      <TabStrip tabs={tabs} active={tab} onSelect={setTab} ariaLabel="Assets and gate passes views" />

      <TabPanel id="register" active={tab}>
        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "mb-4 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
                : "mb-4 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success"
            }
          >
            {notice.message}
          </p>
        )}

        {assets.loading ? (
          <Surface className="p-5">
            <StateBlock tone="loading" title="Loading the asset register…" description="Reading the assets resource." />
          </Surface>
        ) : assets.error ? (
          <Surface className="p-5">
            <StateBlock tone="error" icon={TriangleAlert} title="The asset register could not be loaded" description={assets.error} />
          </Surface>
        ) : rows.length === 0 ? (
          <Surface className="p-5">
            <StateBlock
              tone="empty"
              icon={Inbox}
              title="No assets recorded yet"
              description="Once assets are registered they appear here with their custody and maintenance history."
              action={<OperationCreateDialog resource="assets" label="Register an asset" onCreated={assets.refresh} />}
            />
          </Surface>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Assets in register" value={counts.total} icon={Boxes} tone="primary" />
              <StatTile label="Allocated" value={counts.allocated} icon={PackageCheck} tone="success" />
              <StatTile label="Available" value={counts.available} icon={CircleCheck} tone="info" />
              <StatTile label="In maintenance" value={counts.maintenance} icon={Wrench} tone="warning" />
            </div>

            <Surface className="mt-6 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                <label className="block text-xs font-semibold text-foreground">
                  Search asset tag, name or serial number
                  <span className="relative mt-1.5 block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="e.g. NUC-LAP-0042"
                      className={`${controlClass} pl-9`}
                    />
                  </span>
                </label>
                <label className="block text-xs font-semibold text-foreground">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={`${controlClass} mt-1.5`}
                  >
                    <option value="all">All statuses</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-mono tabular-nums">{filtered.length}</span> of{" "}
                <span className="font-mono tabular-nums">{rows.length}</span> loaded assets. Filters apply to the
                records already loaded on this page.
              </p>
            </Surface>

            <Surface className="mt-4 p-0">
              <DataTable
                caption="Asset register"
                columns={columns}
                rows={filtered}
                rowKey={(row) => row.id}
                minWidth={1240}
                empty={
                  <StateBlock
                    tone="empty"
                    icon={Search}
                    title="No assets match these filters"
                    description="Clear the search box or choose a different status to see the rest of the register."
                  />
                }
              />
            </Surface>

            {panel && panelAsset && (
              <Surface className="mt-4 p-4">
                <SectionHeading
                  title={panel.action === "allocate" ? "Allocate asset" : "Record asset return"}
                  description={
                    panel.action === "allocate"
                      ? "Allocation records the employee taking custody. The engine rejects an allocation without one."
                      : "A return is only accepted with both the condition it came back in and the date it was handed over."
                  }
                />
                <p className="mb-4 font-mono text-xs text-muted-foreground tabular-nums">
                  {textOr(panelAsset.assetTag)} · {textOr(panelAsset.serialNumber)}
                </p>

                {panel.action === "allocate" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-foreground">
                      Employee taking custody
                      <select
                        value={allocateTo}
                        onChange={(event) => setAllocateTo(event.target.value)}
                        className={`${controlClass} mt-1.5`}
                      >
                        <option value="">Choose an employee</option>
                        {people.map((person) => {
                          const id = str(person.id);
                          return (
                            <option key={id} value={id}>
                              {holderLabel(id)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-foreground">
                      Condition on return
                      <select
                        value={returnCondition}
                        onChange={(event) => setReturnCondition(event.target.value)}
                        className={`${controlClass} mt-1.5`}
                      >
                        {RETURN_CONDITIONS.map((condition) => (
                          <option key={condition} value={condition}>
                            {condition}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-foreground">
                      Returned on
                      <input
                        type="date"
                        value={returnedOn}
                        onChange={(event) => setReturnedOn(event.target.value)}
                        className={`${controlClass} mt-1.5`}
                      />
                    </label>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      busy !== "" ||
                      (panel.action === "allocate" ? allocateTo === "" : returnedOn === "" || returnCondition === "")
                    }
                    onClick={() => {
                      if (panel.action === "allocate") {
                        void act(panelAsset, "allocate", { employeeId: allocateTo });
                        return;
                      }
                      void act(panelAsset, "return", { condition: returnCondition, returnedOn });
                    }}
                    className={primaryButtonClass}
                  >
                    {busy === `${panelAsset.id}:${panel.action}`
                      ? "Saving…"
                      : panel.action === "allocate"
                        ? "Confirm allocation"
                        : "Confirm return"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => setPanel(null)}
                    className={actionButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </Surface>
            )}
          </>
        )}
      </TabPanel>

      <TabPanel id="custody" active={tab}>
        <Surface className="mb-4 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill tone="warning" dot>
              Settlement control
            </StatusPill>
          </div>
          <p className="text-sm leading-[21px] text-muted-foreground">
            A full and final settlement cannot be finalised while the leaver still holds an allocated asset. The
            settlement service checks for assets in the <span className="font-mono">allocated</span> status against
            that employee and refuses to finalise until every one has been returned, alongside the clearance and loan
            recovery checks. Recording the return in the register is what releases the settlement.
          </p>
        </Surface>

        {assets.loading ? (
          <Surface className="p-5">
            <StateBlock tone="loading" title="Loading custody positions…" description="Reading the assets resource." />
          </Surface>
        ) : assets.error ? (
          <Surface className="p-5">
            <StateBlock tone="error" icon={TriangleAlert} title="Custody could not be loaded" description={assets.error} />
          </Surface>
        ) : custody.length === 0 ? (
          <Surface className="p-5">
            <StateBlock
              tone="empty"
              icon={PackageCheck}
              title="No assets are currently allocated"
              description="Nothing in the loaded register sits in the allocated status, so no settlement is held up by asset custody."
            />
          </Surface>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatTile label="Assets in employee custody" value={allocated.length} icon={PackageCheck} tone="warning" />
              <StatTile label="Employees holding assets" value={custody.length} icon={Boxes} tone="primary" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {custody.map((group) => (
                <Surface key={group.employeeId || "unassigned"} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate font-heading text-sm font-semibold text-foreground">{group.name}</h3>
                    <StatusPill tone="warning">
                      <span className="font-mono tabular-nums">{group.held.length}</span> held
                    </StatusPill>
                  </div>
                  <ul className="mt-3 divide-y divide-border">
                    {group.held.map((asset) => (
                      <li key={asset.id} className="py-2">
                        <p className="font-mono text-xs font-bold text-foreground tabular-nums">
                          {textOr(asset.assetTag)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {textOr(asset.name)} · serial{" "}
                          <span className="font-mono tabular-nums">{textOr(asset.serialNumber)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </Surface>
              ))}
            </div>
          </>
        )}
      </TabPanel>

      <TabPanel id="gatepasses" active={tab}>
        <GatePassLedger />
      </TabPanel>
    </div>
  );
}

/* ---------------- Gate pass quota and ledger ---------------- */

type PassRow = {
  id: string;
  date: string;
  month: string;
  minutes: number;
  reason: string;
  status: string;
  type: string;
  employee: string;
};

function GatePassLedger() {
  const passesState = useLive("/api/v1/gate-passes?pageSize=100");
  const { nameOf } = usePeople();
  const policy = workforcePolicyDefaults.gatePass;

  const monthStart = monthStartISO();
  const monthKey = monthStart.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T00:00:00Z`));

  const passes = useMemo<PassRow[]>(() => {
    return listFromEnvelope(passesState.data).map((row) => {
      // The ledger endpoint returns `{ id, version, attributes, created_at }`,
      // so every business field is read defensively through `attributes`.
      const attributes = asRecord(row.attributes);
      const created = str(row.created_at);
      const date = str(attributes.date, created.slice(0, 10));
      return {
        id: str(row.id),
        date,
        month: date.slice(0, 7),
        minutes: num(attributes.minutes),
        reason: str(attributes.reason, str(attributes.purpose, "—")),
        status: str(attributes.status, str(row.status, "unknown")),
        type: str(attributes.type, str(attributes.passType, str(attributes.policyCode, "Not recorded"))),
        employee: nameOf(attributes.employeeId ?? row.employeeId, ""),
      };
    });
  }, [passesState.data, nameOf]);

  const period = useMemo(() => {
    // Quota is a calendar-month measure: only this month's passes count, and a
    // rejected pass consumes neither minutes nor a request.
    const inPeriod = passes.filter((pass) => pass.month === monthKey && pass.status !== "rejected");
    const usedMinutes = inPeriod.reduce((total, pass) => total + pass.minutes, 0);
    return { inPeriod, usedMinutes, usedRequests: inPeriod.length };
  }, [passes, monthKey]);

  const allowance = gatePassAllowance(period.usedMinutes, period.usedRequests, policy);
  const nextPass = gatePassAdmissible(period.usedMinutes, period.usedRequests, SHORTEST_PASS_MINUTES, policy);

  function impactOf(pass: PassRow): string {
    if (!policy.creditsNetAttendance) return "Does not credit net attendance";
    if (pass.status === "approved") return `+${minutesLabel(pass.minutes)} credited`;
    if (pass.status === "rejected") return "No credit";
    return "Not credited until approved";
  }

  const columns: Column<PassRow>[] = [
    {
      key: "id",
      header: "Pass reference",
      render: (pass) => (
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{pass.id}</span>
      ),
    },
    {
      key: "employee",
      header: "Employee",
      render: (pass) => (
        <span className={pass.employee ? "font-medium text-foreground" : "text-muted-foreground"}>
          {pass.employee || "Not carried by this endpoint"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (pass) => <span className="text-muted-foreground">{dateLabel(pass.date, "—")}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (pass) => <span className="text-muted-foreground">{pass.type}</span>,
    },
    {
      key: "minutes",
      header: "Duration",
      align: "right",
      render: (pass) => (
        <span className="font-mono text-xs text-foreground tabular-nums">{pass.minutes} min</span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (pass) => <span className="text-muted-foreground">{pass.reason}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (pass) => <StatusPill tone={statusTone(pass.status)}>{pass.status}</StatusPill>,
    },
    {
      key: "impact",
      header: "Net attendance impact",
      render: (pass) => <span className="text-muted-foreground">{impactOf(pass)}</span>,
    },
  ];

  if (passesState.loading) {
    return (
      <Surface className="p-5">
        <StateBlock tone="loading" title="Loading gate passes…" description="Reading the gate pass ledger." />
      </Surface>
    );
  }

  if (passesState.error) {
    return (
      <Surface className="p-5">
        <StateBlock
          tone="error"
          icon={TriangleAlert}
          title="The gate pass ledger could not be loaded"
          description={passesState.error}
        />
      </Surface>
    );
  }

  if (passes.length === 0) {
    return (
      <Surface className="p-5">
        <StateBlock
          tone="empty"
          icon={Inbox}
          title="No gate passes on record"
          description="Quota consumption is only shown once passes exist. Gate passes are raised and decided in the attendance workflow."
          action={
            <Link href="/attendance" className={primaryButtonClass}>
              Open attendance <ArrowRight className="size-4" />
            </Link>
          }
        />
      </Surface>
    );
  }

  return (
    <>
      <Surface className="p-5">
        <SectionHeading
          title={`${monthLabel} · approved and pending passes`}
          description="Quota consumed in the current calendar month. Rejected passes are excluded; passes from earlier months are not counted."
          action={
            <Link href="/attendance" className={primaryButtonClass}>
              Open attendance <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="Gate pass minutes used"
            value={minutesLabel(period.usedMinutes)}
            icon={DoorOpen}
            tone={allowance.exhausted ? "danger" : "primary"}
            hint={
              <>
                <span>
                  Ceiling <span className="font-mono tabular-nums">{minutesLabel(policy.monthlyCeilingMinutes)}</span> ·{" "}
                  <span className="font-mono tabular-nums">{minutesLabel(allowance.remainingMinutes)}</span> remaining
                </span>
                <div className="mt-2">
                  <ProgressMeter
                    value={period.usedMinutes}
                    max={policy.monthlyCeilingMinutes}
                    tone={allowance.exhausted ? "danger" : "primary"}
                  />
                </div>
              </>
            }
          />
          <StatTile
            label="Requests used"
            value={`${period.usedRequests} / ${policy.maxRequestsPerMonth}`}
            icon={CircleCheck}
            tone={allowance.remainingRequests === 0 ? "danger" : "info"}
            hint={
              <>
                <span>
                  <span className="font-mono tabular-nums">{allowance.remainingRequests}</span> request
                  {allowance.remainingRequests === 1 ? "" : "s"} remaining this month
                </span>
                <div className="mt-2">
                  <ProgressMeter
                    value={period.usedRequests}
                    max={policy.maxRequestsPerMonth}
                    tone={allowance.remainingRequests === 0 ? "danger" : "primary"}
                  />
                </div>
              </>
            }
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          A further {SHORTEST_PASS_MINUTES}-minute pass against this position is{" "}
          {nextPass.admissible ? "admissible" : `not admissible. ${nextPass.reason}`}
          {nextPass.admissible ? "." : ""} The ceilings are the per-employee monthly gate pass policy. This ledger
          endpoint does not carry an employee reference, so the figures above aggregate every pass it returned for the
          period rather than one person&apos;s consumption.
        </p>
      </Surface>

      <Surface className="mt-4 p-0">
        <DataTable
          caption="Gate pass ledger"
          columns={columns}
          rows={passes}
          rowKey={(pass) => pass.id}
          minWidth={1100}
        />
      </Surface>
    </>
  );
}
