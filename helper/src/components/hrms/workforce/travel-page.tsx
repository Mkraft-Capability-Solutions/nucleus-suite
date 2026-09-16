"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CalendarClock,
  CircleAlert,
  Clock3,
  Inbox,
  Plane,
  ReceiptText,
  RefreshCw,
  Route,
  Scale,
  Wallet,
} from "lucide-react";
import { operationalResources } from "@/lib/operational-catalog";
import { OperationCreateDialog } from "../operation-create-dialog";
import {
  DataTable,
  PageIntro,
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
  currencyLabel,
  dateLabel,
  num,
  runTransition,
  statusTone,
  str,
  todayISO,
  useOperational,
  usePeople,
  type OperationalRecord,
} from "./records";

/**
 * Travel & Duty Management.
 *
 * Reads the catalog resources `travel` (duty requests) and `expenses`
 * (claims) through the shared operational engine. Every figure on this page is
 * derived from those two responses; nothing is sampled or modelled.
 */

const REQUEST_TYPE_LABELS: Record<string, string> = {
  business_travel: "Business travel",
  local_duty: "Local duty",
  field_visit: "Field visit",
};

const TRANSPORT_LABELS: Record<string, string> = {
  rail: "Rail",
  air: "Air",
  road: "Road",
  company_vehicle: "Company vehicle",
};

const CATEGORY_LABELS: Record<string, string> = {
  transport: "Transport",
  accommodation: "Accommodation",
  meals: "Meals",
  other: "Other",
};

const ACTION_LABELS: Record<string, string> = {
  submit: "Submit",
  approve: "Approve",
  return: "Return",
  reject: "Reject",
  cancel: "Cancel",
  complete: "Mark complete",
  reimburse: "Reimburse",
};

/** Statuses counted as an advance the employee still holds. */
const ADVANCE_STATUSES = ["approved", "completed"];
/** Statuses counted as a claim the company has accepted. */
const CLAIM_STATUSES = ["approved", "reimbursed"];

function words(value: string): string {
  if (!value) return "";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labelled(value: unknown, labels: Record<string, string>, fallback = "Not recorded"): string {
  const raw = str(value);
  if (!raw) return fallback;
  return labels[raw] ?? words(raw);
}

/** Renders a minor-unit amount, falling back honestly when the currency code is unusable. */
function moneyLabel(minor: number, currency?: unknown): string {
  const raw = str(currency, "INR").trim();
  const code = raw.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return `${(minor / 100).toFixed(2)} ${raw}`.trim();
  try {
    return currencyLabel(minor, code);
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

function currencyCode(currency: unknown): string {
  const code = str(currency, "INR").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : str(currency, "INR").trim();
}

/** Only the transitions the catalog declares legal from this record's status. */
function legalActions(resource: "travel" | "expenses", status: string): string[] {
  return Object.entries(operationalResources[resource].transitions)
    .filter(([, transition]) => transition.from.includes(status))
    .map(([action]) => action);
}

type Notice = { tone: "status" | "alert"; text: string } | null;

const controlClass =
  "h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const actionButtonClass =
  "inline-flex h-10 items-center rounded-lg border border-border px-3 font-heading text-[12px] font-semibold text-foreground transition-colors duration-150 hover:bg-secondary disabled:opacity-50";

export function TravelPage() {
  const travel = useOperational("travel");
  const expenses = useOperational("expenses");
  const { nameOf } = usePeople();

  const [tab, setTab] = useState("requests");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});

  const travelRefresh = travel.refresh;
  const expensesRefresh = expenses.refresh;

  const act = useCallback(
    async (
      resource: "travel" | "expenses",
      row: OperationalRecord,
      action: string,
      body: Record<string, unknown>,
      onDone: () => void,
    ) => {
      const key = `${resource}:${row.id}:${action}`;
      setBusy(key);
      setNotice({ tone: "status", text: `${ACTION_LABELS[action] ?? words(action)} in progress…` });
      const result = await runTransition(resource, row.id, row.version, action, body);
      setBusy("");
      setNotice({ tone: result.ok ? "status" : "alert", text: result.message });
      if (result.ok) {
        if (resource === "expenses") {
          setPaymentReferences((current) => {
            const next = { ...current };
            delete next[row.id];
            return next;
          });
        }
        onDone();
      }
    },
    [],
  );

  // ---- Requests -----------------------------------------------------------
  const travelStatuses = useMemo(
    () => Array.from(new Set(travel.rows.map((row) => row.status))).sort(),
    [travel.rows],
  );

  const filteredTravel = useMemo(
    () =>
      travel.rows.filter((row) => {
        if (typeFilter !== "all" && str(row.requestType) !== typeFilter) return false;
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        return true;
      }),
    [travel.rows, typeFilter, statusFilter],
  );

  const requestStats = useMemo(() => {
    const today = todayISO();
    const awaiting = filteredTravel.filter((row) => row.status === "submitted").length;
    const upcoming = filteredTravel.filter(
      (row) => row.status === "approved" && str(row.startDate) > today,
    ).length;
    const advance = filteredTravel
      .filter((row) => row.status === "approved")
      .reduce((total, row) => total + num(row.advanceMinor), 0);
    return { total: filteredTravel.length, awaiting, upcoming, advance };
  }, [filteredTravel]);

  const travelColumns: Column<OperationalRecord>[] = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{nameOf(row.employeeId)}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{row.id.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        key: "requestType",
        header: "Request type",
        render: (row) => (
          <span className="text-muted-foreground">{labelled(row.requestType, REQUEST_TYPE_LABELS)}</span>
        ),
      },
      {
        key: "purpose",
        header: "Purpose",
        render: (row) => <span className="text-foreground">{str(row.purpose, "Not recorded")}</span>,
      },
      {
        key: "route",
        header: "Route",
        render: (row) => (
          <span className="text-muted-foreground">
            {str(row.origin, "Origin pending")} → {str(row.destination, "Destination pending")}
          </span>
        ),
      },
      {
        key: "dates",
        header: "Dates",
        render: (row) => (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {dateLabel(row.startDate)} – {dateLabel(row.endDate)}
          </span>
        ),
      },
      {
        key: "transport",
        header: "Transport",
        render: (row) => (
          <span className="text-muted-foreground">{labelled(row.transport, TRANSPORT_LABELS)}</span>
        ),
      },
      {
        key: "estimatedCost",
        header: "Estimated cost",
        align: "right",
        render: (row) => (
          <span className="font-mono text-[12px] text-foreground tabular-nums">
            {currencyLabel(num(row.estimatedCostMinor))}
          </span>
        ),
      },
      {
        key: "advance",
        header: "Advance",
        align: "right",
        render: (row) => (
          <span className="font-mono text-[12px] text-foreground tabular-nums">
            {currencyLabel(num(row.advanceMinor))}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusPill tone={statusTone(row.status)}>{words(row.status)}</StatusPill>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => {
          const actions = legalActions("travel", row.status);
          if (actions.length === 0) {
            return <span className="text-[12px] text-muted-foreground">No action available</span>;
          }
          return (
            <div className="flex flex-wrap gap-1.5">
              {actions.map((action) => {
                const key = `travel:${row.id}:${action}`;
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => act("travel", row, action, {}, travelRefresh)}
                    className={actionButtonClass}
                  >
                    {busy === key ? "Working…" : ACTION_LABELS[action] ?? words(action)}
                  </button>
                );
              })}
            </div>
          );
        },
      },
    ],
    [act, busy, nameOf, travelRefresh],
  );

  // ---- Claims -------------------------------------------------------------
  const travelById = useMemo(() => {
    const index = new Map<string, OperationalRecord>();
    for (const row of travel.rows) index.set(row.id, row);
    return index;
  }, [travel.rows]);

  const claimColumns: Column<OperationalRecord>[] = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{nameOf(row.employeeId)}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{row.id.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        key: "travel",
        header: "Linked travel request",
        render: (row) => {
          const reference = str(row.travelId);
          if (!reference) return <span className="text-[12px] text-muted-foreground">Not linked</span>;
          const linked = travelById.get(reference);
          if (!linked) {
            return <span className="font-mono text-[11px] text-muted-foreground">{reference}</span>;
          }
          return (
            <div className="min-w-0">
              <p className="text-foreground">{str(linked.purpose, "Purpose not recorded")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {str(linked.origin, "Origin pending")} → {str(linked.destination, "Destination pending")}
              </p>
            </div>
          );
        },
      },
      {
        key: "expenseDate",
        header: "Expense date",
        render: (row) => (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {dateLabel(row.expenseDate)}
          </span>
        ),
      },
      {
        key: "category",
        header: "Category",
        render: (row) => (
          <span className="text-muted-foreground">{labelled(row.category, CATEGORY_LABELS)}</span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        render: (row) => (
          <span className="font-mono text-[12px] text-foreground tabular-nums">
            {moneyLabel(num(row.amountMinor), row.currency)}
          </span>
        ),
      },
      {
        key: "receipt",
        header: "Receipt reference",
        render: (row) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {str(row.receiptDocumentId, "No receipt reference")}
          </span>
        ),
      },
      {
        key: "description",
        header: "Description",
        render: (row) => (
          <span className="text-muted-foreground">{str(row.description, "No description")}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusPill tone={statusTone(row.status)}>{words(row.status)}</StatusPill>,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => {
          const actions = legalActions("expenses", row.status);
          if (actions.length === 0) {
            return <span className="text-[12px] text-muted-foreground">No action available</span>;
          }
          const reference = paymentReferences[row.id] ?? "";
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {actions
                  .filter((action) => action !== "reimburse")
                  .map((action) => {
                    const key = `expenses:${row.id}:${action}`;
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={busy !== ""}
                        onClick={() => act("expenses", row, action, {}, expensesRefresh)}
                        className={actionButtonClass}
                      >
                        {busy === key ? "Working…" : ACTION_LABELS[action] ?? words(action)}
                      </button>
                    );
                  })}
              </div>
              {actions.includes("reimburse") && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="sr-only" htmlFor={`payment-reference-${row.id}`}>
                    Payment reference for this claim
                  </label>
                  <input
                    id={`payment-reference-${row.id}`}
                    value={reference}
                    onChange={(event) =>
                      setPaymentReferences((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                    placeholder="Payment reference"
                    className={`${controlClass} w-44 font-mono text-[12px]`}
                  />
                  <button
                    type="button"
                    disabled={busy !== "" || reference.trim() === ""}
                    onClick={() =>
                      act("expenses", row, "reimburse", { paymentReference: reference.trim() }, expensesRefresh)
                    }
                    className={actionButtonClass}
                  >
                    {busy === `expenses:${row.id}:reimburse` ? "Working…" : "Reimburse"}
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [act, busy, expensesRefresh, nameOf, paymentReferences, travelById],
  );

  // ---- Reconciliation -----------------------------------------------------
  type ReconciliationRow = {
    employeeId: string;
    name: string;
    advanceMinor: number;
    claimMinor: number;
    balanceMinor: number;
    currencies: string[];
  };

  const reconciliation = useMemo<ReconciliationRow[]>(() => {
    const index = new Map<string, ReconciliationRow>();
    const ensure = (employeeId: string) => {
      const existing = index.get(employeeId);
      if (existing) return existing;
      const created: ReconciliationRow = {
        employeeId,
        name: nameOf(employeeId),
        advanceMinor: 0,
        claimMinor: 0,
        balanceMinor: 0,
        currencies: [],
      };
      index.set(employeeId, created);
      return created;
    };

    for (const row of travel.rows) {
      if (!ADVANCE_STATUSES.includes(row.status)) continue;
      ensure(str(row.employeeId)).advanceMinor += num(row.advanceMinor);
    }
    for (const row of expenses.rows) {
      if (!CLAIM_STATUSES.includes(row.status)) continue;
      const entry = ensure(str(row.employeeId));
      entry.claimMinor += num(row.amountMinor);
      const code = currencyCode(row.currency);
      if (code && !entry.currencies.includes(code)) entry.currencies.push(code);
    }

    return Array.from(index.values())
      .map((entry) => ({ ...entry, balanceMinor: entry.advanceMinor - entry.claimMinor }))
      .sort((left, right) => Math.abs(right.balanceMinor) - Math.abs(left.balanceMinor));
  }, [expenses.rows, nameOf, travel.rows]);

  const reconciliationColumns: Column<ReconciliationRow>[] = useMemo(
    () => [
      {
        key: "employee",
        header: "Employee",
        render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
      },
      {
        key: "advance",
        header: "Advances taken",
        align: "right",
        render: (row) => (
          <span className="font-mono text-[12px] text-foreground tabular-nums">
            {currencyLabel(row.advanceMinor)}
          </span>
        ),
      },
      {
        key: "claims",
        header: "Claims accepted",
        align: "right",
        render: (row) => (
          <span className="font-mono text-[12px] text-foreground tabular-nums">
            {currencyLabel(row.claimMinor)}
          </span>
        ),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        render: (row) => {
          const foreign = row.currencies.filter((code) => code !== "INR");
          if (foreign.length > 0) {
            return (
              <div className="flex flex-col items-end gap-1">
                <StatusPill tone="warning">Mixed currencies</StatusPill>
                <span className="text-[11px] text-muted-foreground">
                  Claims recorded in {row.currencies.join(", ")}; no single balance is shown.
                </span>
              </div>
            );
          }
          if (row.balanceMinor === 0) {
            return <span className="text-[12px] text-muted-foreground">Settled</span>;
          }
          const recoverable = row.balanceMinor > 0;
          return (
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-[12px] font-bold text-foreground tabular-nums">
                {currencyLabel(Math.abs(row.balanceMinor))}
              </span>
              <StatusPill tone={recoverable ? "warning" : "info"}>
                {recoverable ? "Recoverable from employee" : "Payable to employee"}
              </StatusPill>
            </div>
          );
        },
      },
    ],
    [],
  );

  // ---- Shell --------------------------------------------------------------
  const tabs: TabDefinition[] = [
    { id: "requests", label: "Travel & duty requests", icon: Plane, count: travel.rows.length },
    { id: "claims", label: "Expense claims", icon: ReceiptText, count: expenses.rows.length },
    { id: "reconciliation", label: "Advance reconciliation", icon: Scale, count: reconciliation.length },
  ];

  function loadState(state: { loading: boolean; error: string }, subject: string) {
    if (state.error) {
      return (
        <StateBlock
          tone="error"
          icon={CircleAlert}
          title={`${subject} could not be loaded`}
          description={state.error}
        />
      );
    }
    if (state.loading) {
      return <StateBlock tone="loading" icon={RefreshCw} title={`Loading ${subject.toLowerCase()}…`} />;
    }
    return null;
  }

  const travelState = loadState(travel, "Travel requests");
  const claimsState = loadState(expenses, "Expense claims");

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Travel & duty management"
        title="Travel, duty and expense control"
        description="Approve duty travel, settle expense claims and reconcile outstanding advances. Every figure below is read live from the travel and expense registers."
        action={<OperationCreateDialog resource="travel" label="New travel request" onCreated={travelRefresh} />}
      />

      {notice && (
        <div
          role={notice.tone === "alert" ? "alert" : "status"}
          className={
            notice.tone === "alert"
              ? "mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
              : "mb-4 rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground"
          }
        >
          {notice.text}
        </div>
      )}

      <TabStrip tabs={tabs} active={tab} onSelect={setTab} ariaLabel="Travel and duty workspaces" />

      <TabPanel id="requests" active={tab}>
        <Surface className="p-5">
          <SectionHeading
            title="Travel & duty requests"
            description="Business travel, local duty and field visits raised for approval."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={travelRefresh}
                  aria-label="Refresh travel requests"
                  className="grid size-10 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-secondary"
                >
                  <RefreshCw className="size-4" strokeWidth={2} />
                </button>
                <OperationCreateDialog
                  resource="travel"
                  label="Raise request"
                  variant="secondary"
                  onCreated={travelRefresh}
                />
              </div>
            }
          />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="travel-type-filter">
              Filter by request type
            </label>
            <select
              id="travel-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={controlClass}
            >
              <option value="all">All request types</option>
              {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="travel-status-filter">
              Filter by status
            </label>
            <select
              id="travel-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={controlClass}
            >
              <option value="all">All statuses</option>
              {travelStatuses.map((status) => (
                <option key={status} value={status}>
                  {words(status)}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-muted-foreground">
              Filters apply to the {travel.rows.length} request
              {travel.rows.length === 1 ? "" : "s"} loaded from the register.
            </span>
          </div>

          {travelState ??
            (filteredTravel.length === 0 ? (
              <StateBlock
                icon={Inbox}
                title={travel.rows.length === 0 ? "No travel requests yet" : "No requests match these filters"}
                description={
                  travel.rows.length === 0
                    ? "Once a travel or duty request is raised it appears here with its route, cost and next available action."
                    : "Clear the request type or status filter to see the rest of the register."
                }
              />
            ) : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile label="Requests in view" value={requestStats.total} icon={Plane} tone="primary" />
                  <StatTile
                    label="Awaiting approval"
                    value={requestStats.awaiting}
                    hint="Submitted and not yet actioned"
                    icon={Clock3}
                    tone="warning"
                  />
                  <StatTile
                    label="Approved and upcoming"
                    value={requestStats.upcoming}
                    hint="Approved with a start date after today"
                    icon={CalendarClock}
                    tone="info"
                  />
                  <StatTile
                    label="Advance outstanding"
                    value={currencyLabel(requestStats.advance)}
                    hint="Advances on approved, not yet completed requests"
                    icon={Wallet}
                    tone="neutral"
                  />
                </div>
                <DataTable
                  columns={travelColumns}
                  rows={filteredTravel}
                  rowKey={(row) => row.id}
                  minWidth={1320}
                  caption="Travel and duty requests"
                />
              </>
            ))}
        </Surface>
      </TabPanel>

      <TabPanel id="claims" active={tab}>
        <Surface className="p-5">
          <SectionHeading
            title="Expense claims"
            description="Claims raised against travel and duty, with their receipt reference and settlement state."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={expensesRefresh}
                  aria-label="Refresh expense claims"
                  className="grid size-10 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-secondary"
                >
                  <RefreshCw className="size-4" strokeWidth={2} />
                </button>
                <OperationCreateDialog
                  resource="expenses"
                  label="Raise claim"
                  variant="secondary"
                  onCreated={expensesRefresh}
                />
              </div>
            }
          />

          <p className="mb-4 text-[12px] text-muted-foreground">
            Reimbursement records a payment reference against the claim and needs accounting rights in
            addition to travel approval. If the server declines, its message is shown above.
          </p>

          {claimsState ?? (
            <DataTable
              columns={claimColumns}
              rows={expenses.rows}
              rowKey={(row) => row.id}
              minWidth={1320}
              caption="Expense claims"
              empty={
                <StateBlock
                  icon={ReceiptText}
                  title="No expense claims yet"
                  description="Claims raised against a travel request or as standalone duty expenses appear here for approval and reimbursement."
                />
              }
            />
          )}
        </Surface>
      </TabPanel>

      <TabPanel id="reconciliation" active={tab}>
        <Surface className="p-5">
          <SectionHeading
            title="Advance reconciliation"
            description="What each employee holds in travel advances against the claims already accepted."
          />

          <div className="mb-4 rounded-lg border border-border bg-secondary p-4 text-[12px] leading-5 text-muted-foreground">
            <p className="flex items-center gap-2 font-heading text-[13px] font-semibold text-foreground">
              <Route className="size-4" strokeWidth={2} />
              Basis of these figures
            </p>
            <p className="mt-1.5">
              Advances count the advance amount on travel requests that are approved or completed. Claims count
              expense claims that are approved or reimbursed. Draft, submitted, returned, rejected and cancelled
              records are excluded on both sides. A positive balance is recoverable from the employee; a negative
              balance is payable to them.
            </p>
          </div>

          {travelState ??
            claimsState ??
            (travel.rows.length === 0 || expenses.rows.length === 0 ? (
              <StateBlock
                icon={Scale}
                title="Reconciliation needs both registers"
                description={
                  travel.rows.length === 0 && expenses.rows.length === 0
                    ? "No travel requests and no expense claims have been recorded, so there is nothing to reconcile."
                    : travel.rows.length === 0
                      ? "No travel requests have been recorded, so advances cannot be established. Expense claims alone cannot be reconciled."
                      : "No expense claims have been recorded, so accepted claims cannot be established. Travel advances alone cannot be reconciled."
                }
              />
            ) : (
              <DataTable
                columns={reconciliationColumns}
                rows={reconciliation}
                rowKey={(row) => row.employeeId}
                minWidth={760}
                caption="Advance reconciliation by employee"
                empty={
                  <StateBlock
                    icon={Scale}
                    title="Nothing to reconcile yet"
                    description="No travel request has reached approved or completed, and no claim has reached approved or reimbursed."
                  />
                }
              />
            ))}
        </Surface>
      </TabPanel>
    </div>
  );
}
