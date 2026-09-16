"use client";

import { picklistValues } from "@/lib/picklists";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ClipboardCheck, History, Inbox, Layers, ListChecks, RefreshCcw, Search } from "lucide-react";
import { operationalResources } from "@/lib/operational-catalog";
import { humanize } from "@/lib/workflow-catalog";
import {
  DataTable,
  PageIntro,
  SectionHeading,
  StatTile,
  StateBlock,
  StatusPill,
  Surface,
  type Column,
} from "../page-primitives";
import {
  dateLabel,
  listFromEnvelope,
  num,
  runTransition,
  statusTone,
  str,
  useLive,
  usePeople,
} from "./records";

/**
 * Unified Approval Inbox.
 *
 * The queue is exactly what `GET /api/v1/workspace/approvals` returns, which is
 * `{ id, version, title, status, feature, href }` per item — no timestamps and
 * no resource key. The resource is recovered from the item's own `href`
 * (`?section=operations/<resource>`) so the catalog can supply the transitions
 * that are legal from the record's current status. Nothing on this page is
 * padded with a value the endpoint did not send.
 */

const QUEUE_PATH = "/api/v1/workspace/approvals";
const QUEUE_CAP = 100;
const ACTION_ORDER = ["approve", "return", "reject"];

const controlClass =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary";

type QueueItem = {
  id: string;
  version: number;
  title: string;
  status: string;
  feature: string;
  href: string;
  resource: string;
  position: number;
};

type HistoryEvent = { id: string; action: string; reason: string; status: string; createdAt: string };

/** Extra inputs the engine requires alongside `reason` for specific transitions. */
type ExtraField = { name: string; label: string; kind: "person" | "text" | "date" | "condition" };

const ASSET_CONDITIONS = picklistValues("PL_ASSET_RETURN_CONDITION");

function extraFieldsFor(resource: string, action: string): ExtraField[] {
  if (action === "allocate") return [{ name: "employeeId", label: "Employee receiving custody", kind: "person" }];
  if (action === "assign") return [{ name: "ownerEmployeeId", label: "Owner taking the ticket", kind: "person" }];
  if (action === "reimburse" || action === "finalize") {
    return [{ name: "paymentReference", label: "Completed payment reference", kind: "text" }];
  }
  if (action === "file" || action === "accept") {
    return [{ name: "acknowledgementReference", label: "Authority acknowledgement reference", kind: "text" }];
  }
  if (resource === "assets" && action === "return") {
    return [
      { name: "condition", label: "Condition on return", kind: "condition" },
      { name: "returnedOn", label: "Returned on", kind: "date" },
    ];
  }
  return [];
}

function resourceFromHref(href: string): string {
  const query = href.split("?")[1] ?? "";
  const section = new URLSearchParams(query).get("section") ?? "";
  const key = section.replace(/^operations\//, "");
  return Object.hasOwn(operationalResources, key) ? key : "";
}

function transitionsFrom(resource: string, status: string) {
  if (!resource) return { approvals: [] as string[], others: [] as string[] };
  const entries = Object.entries(operationalResources[resource].transitions).filter(([, transition]) =>
    transition.from.includes(status),
  );
  const rank = (action: string) => {
    const index = ACTION_ORDER.indexOf(action);
    return index < 0 ? ACTION_ORDER.length : index;
  };
  return {
    approvals: entries
      .filter(([, transition]) => transition.approval === true)
      .map(([action]) => action)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)),
    others: entries
      .filter(([, transition]) => transition.approval !== true)
      .map(([action]) => action)
      .sort((a, b) => a.localeCompare(b)),
  };
}

export function UnifiedApprovalInboxPage() {
  const queue = useLive(QUEUE_PATH);
  const { people, nameOf, error: peopleError } = usePeople();

  const [featureFilter, setFeatureFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  const items = useMemo<QueueItem[]>(
    () =>
      listFromEnvelope(queue.data).map((row, index) => {
        const href = str(row.href);
        return {
          id: str(row.id),
          version: num(row.version, 1),
          title: str(row.title, "Untitled record"),
          status: str(row.status, "unknown"),
          feature: str(row.feature, "Unlabelled work area"),
          href,
          resource: resourceFromHref(href),
          position: index + 1,
        };
      }),
    [queue.data],
  );

  const features = useMemo(() => [...new Set(items.map((item) => item.feature))].sort((a, b) => a.localeCompare(b)), [items]);
  const statuses = useMemo(() => [...new Set(items.map((item) => item.status))].sort((a, b) => a.localeCompare(b)), [items]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (featureFilter !== "all" && item.feature !== featureFilter) return false;
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle);
    });
  }, [items, featureFilter, search]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const legal = selected ? transitionsFrom(selected.resource, selected.status) : { approvals: [], others: [] };
  const extras = selected && action ? extraFieldsFor(selected.resource, action) : [];
  const reasonReady = reason.trim().length >= 3;
  const extrasReady = extras.every((field) => (extraValues[field.name] ?? "").trim().length >= (field.kind === "text" ? 3 : 1));
  const canSubmit = Boolean(selected && action) && reasonReady && extrasReady && !busy;

  function selectRow(item: QueueItem) {
    setSelectedId(item.id === selectedId ? "" : item.id);
    setAction("");
    setReason("");
    setExtraValues({});
    setFailure("");
    setNotice("");
  }

  function chooseAction(next: string) {
    setAction(next === action ? "" : next);
    setExtraValues({});
    setFailure("");
  }

  async function submitDecision() {
    if (!selected || !action || !canSubmit) return;
    setBusy(true);
    setFailure("");
    setNotice("");
    const body: Record<string, unknown> = { reason: reason.trim() };
    for (const field of extras) body[field.name] = (extraValues[field.name] ?? "").trim();
    const result = await runTransition(selected.resource, selected.id, selected.version, action, body);
    setBusy(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setNotice(`${result.message} ${humanize(action)} recorded for ${selected.title}. The queue has been reloaded.`);
    setSelectedId("");
    setAction("");
    setReason("");
    setExtraValues({});
    queue.refresh();
  }

  const columns: Column<QueueItem>[] = [
    {
      key: "position",
      header: "Wait",
      width: "56px",
      render: (row) => <span className="font-mono text-[11px] text-muted-foreground tabular-nums">#{row.position}</span>,
    },
    {
      key: "record",
      header: "Request",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.title}</p>
          <p className="mt-1 max-w-52 truncate font-mono text-[10px] text-muted-foreground">{row.id}</p>
        </div>
      ),
    },
    {
      key: "feature",
      header: "Work area",
      render: (row) => <span className="text-muted-foreground">{row.feature}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill tone={statusTone(row.status)}>{humanize(row.status)}</StatusPill>,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageIntro
        eyebrow="Workforce operations"
        title="Unified approval inbox"
        description="Every operational request across the workspace that is waiting on a decision from you, with the actions your role can legally take on each one."
        action={
          <button
            type="button"
            onClick={() => queue.refresh()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            <RefreshCcw className="size-4" strokeWidth={2} />
            Reload queue
          </button>
        }
      />

      <Surface className="p-5">
        <SectionHeading
          title="What this queue contains"
          description="Read this before you act, so the list is not mistaken for the whole workspace."
        />
        <ul className="grid gap-2 text-sm leading-[21px] text-muted-foreground sm:grid-cols-2">
          <li>
            Records from every workflow module where your role holds the approve or team-approve permission for that
            module, and only those sitting in a status an approval action can move.
          </li>
          <li>
            Requests you raised yourself are excluded, and so is any record attached to your own employee record, so a
            reviewer cannot approve their own work.
          </li>
          <li>
            With a team-scoped permission you see only records belonging to your direct reports; grievance tickets stay
            out of team scope entirely.
          </li>
          <li>
            The server returns the longest-waiting records first and caps the response at {QUEUE_CAP} items. It sends the
            title, work area, status and reference only — no timestamps — so no wait time is shown per row.
          </li>
        </ul>
      </Surface>

      {queue.error ? (
        <Surface className="mt-4 p-5">
          <StateBlock
            tone="error"
            icon={Inbox}
            title="The approval queue could not be loaded."
            description={queue.error}
            action={
              <button
                type="button"
                onClick={() => queue.refresh()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
              >
                <RefreshCcw className="size-4" strokeWidth={2} />
                Try again
              </button>
            }
          />
        </Surface>
      ) : queue.loading ? (
        <Surface className="mt-4 p-5">
          <StateBlock tone="loading" icon={Inbox} title="Loading your approval queue…" />
        </Surface>
      ) : items.length === 0 ? (
        <Surface className="mt-4 p-5">
          <StateBlock
            tone="empty"
            icon={ClipboardCheck}
            title="Nothing is waiting for your review"
            description="No record in your permitted scope is currently in a status that needs a decision from you."
          />
        </Surface>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Items awaiting your review"
              value={items.length}
              icon={Inbox}
              tone="primary"
              hint={items.length === QUEUE_CAP ? "Capped by the server — more may exist" : "Returned by the workspace approvals endpoint"}
            />
            <StatTile
              label="Work areas represented"
              value={features.length}
              icon={Layers}
              tone="info"
              hint={features.slice(0, 3).join(", ") + (features.length > 3 ? ` and ${features.length - 3} more` : "")}
            />
            <StatTile
              label="Distinct statuses in the queue"
              value={statuses.length}
              icon={ListChecks}
              tone="neutral"
              hint={statuses.map((status) => humanize(status)).join(", ")}
            />
          </div>

          {items.length === QUEUE_CAP && (
            <p role="status" className="mt-3 rounded-lg border border-border bg-secondary p-3 text-sm text-muted-foreground">
              The endpoint returns at most {QUEUE_CAP} items and this response is full, so more requests may be waiting.
              Open the module registers to review the rest.
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="mt-3 rounded-lg border border-success/25 bg-success/10 p-3 text-sm font-medium text-success"
            >
              {notice}
            </p>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <Surface className={`min-w-0 p-0 ${selected ? "hidden lg:block" : ""}`}>
              <div className="border-b border-border px-5 py-4">
                <SectionHeading
                  title="Work queue"
                  description="Longest-waiting request first, in the order the server returned it."
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Work area</span>
                    <select
                      className={controlClass}
                      value={featureFilter}
                      onChange={(event) => setFeatureFilter(event.target.value)}
                    >
                      <option value="all">All work areas ({items.length})</option>
                      {features.map((feature) => (
                        <option key={feature} value={feature}>
                          {feature} ({items.filter((item) => item.feature === feature).length})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                      Search title or reference
                    </span>
                    <span className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                      <input
                        type="search"
                        className={controlClass + " pl-9"}
                        value={search}
                        placeholder="Type to filter"
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </span>
                  </label>
                </div>
              </div>

              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(row) => row.id}
                minWidth={520}
                onRowClick={selectRow}
                selectedKey={selectedId}
                caption="Requests waiting for your decision"
                empty={
                  <StateBlock
                    tone="empty"
                    icon={Search}
                    title="No request matches these filters"
                    description="Clear the work-area filter or the search text to see the full queue again."
                  />
                }
              />
            </Surface>

            {selected ? (
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedId("")}
                  className="mb-3 inline-flex h-10 min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-secondary lg:hidden"
                >
                  <ChevronLeft className="size-4" strokeWidth={2} />
                  Back to queue
                </button>
                <DetailPanel
                  key={selected.id}
                  item={selected}
                  legal={legal}
                  action={action}
                  onChooseAction={chooseAction}
                  reason={reason}
                  onReason={setReason}
                  extras={extras}
                  extraValues={extraValues}
                  onExtra={(name, value) => setExtraValues((current) => ({ ...current, [name]: value }))}
                  people={people}
                  peopleError={peopleError}
                  nameOf={nameOf}
                  reasonReady={reasonReady}
                  extrasReady={extrasReady}
                  canSubmit={canSubmit}
                  busy={busy}
                  failure={failure}
                  onSubmit={submitDecision}
                />
              </div>
            ) : (
              <Surface className="hidden min-w-0 p-5 lg:block">
                <StateBlock
                  tone="empty"
                  icon={ClipboardCheck}
                  title="Select a request to review it"
                  description="Choose a row in the queue to see its work area, reference, recorded history and the decisions available from its current status."
                />
              </Surface>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DetailPanel({
  item,
  legal,
  action,
  onChooseAction,
  reason,
  onReason,
  extras,
  extraValues,
  onExtra,
  people,
  peopleError,
  nameOf,
  reasonReady,
  extrasReady,
  canSubmit,
  busy,
  failure,
  onSubmit,
}: {
  item: QueueItem;
  legal: { approvals: string[]; others: string[] };
  action: string;
  onChooseAction: (action: string) => void;
  reason: string;
  onReason: (reason: string) => void;
  extras: ExtraField[];
  extraValues: Record<string, string>;
  onExtra: (name: string, value: string) => void;
  people: Record<string, unknown>[];
  peopleError: string;
  nameOf: (id: unknown, fallback?: string) => string;
  reasonReady: boolean;
  extrasReady: boolean;
  canSubmit: boolean;
  busy: boolean;
  failure: string;
  onSubmit: () => void;
}) {
  const history = useLive(item.resource ? `/api/v1/operations/${item.resource}/${item.id}/history?page=1&pageSize=20` : "");
  const events = useMemo<HistoryEvent[]>(
    () =>
      listFromEnvelope(history.data).map((row) => ({
        id: str(row.id),
        action: str(row.action, "unknown"),
        reason: str(row.reason),
        status: str(row.status),
        createdAt: str(row.created_at),
      })),
    [history.data],
  );

  return (
    <Surface className="p-5">
      <SectionHeading
        title={item.title}
        description={`${item.feature} · this record is currently ${humanize(item.status).toLowerCase()}.`}
        action={<StatusPill tone={statusTone(item.status)} dot>{humanize(item.status)}</StatusPill>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Record reference</p>
          <p className="mt-1 break-all font-mono text-[11px] text-foreground tabular-nums">{item.id}</p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
            Version {item.version} · queue position #{item.position}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Work area</p>
          <p className="mt-1 text-sm font-medium text-foreground">{item.feature}</p>
          {item.href && (
            <Link
              href={item.href}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Open the full register
              <ArrowUpRight className="size-4" strokeWidth={2} />
            </Link>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <SectionHeading
          title="Decision"
          description={`Only the actions the workflow allows from the ${humanize(item.status).toLowerCase()} status are offered.`}
        />

        {legal.approvals.length === 0 ? (
          <StateBlock
            tone="empty"
            icon={ClipboardCheck}
            title="No approval action is available here"
            description={
              item.resource
                ? "This record's workflow declares no approval transition from its current status. Open the register to see what its owner can do next."
                : "This item's work area could not be matched to a workflow definition, so no action can be offered safely."
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {legal.approvals.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={candidate === action}
                  onClick={() => onChooseAction(candidate)}
                  className={
                    "inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold transition-colors duration-150 " +
                    (candidate === action
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground")
                  }
                >
                  {humanize(candidate)}
                </button>
              ))}
            </div>

            {legal.others.length > 0 && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                {legal.others.map((other) => humanize(other)).join(", ")} also
                {legal.others.length > 1 ? " move" : " moves"} this record from here, but
                {legal.others.length > 1 ? " those are" : " that is"} the requester&apos;s action rather than an approval.
                Use the register link above.
              </p>
            )}

            {action && (
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    Reason for this decision (required)
                  </span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground outline-none focus:border-primary"
                    value={reason}
                    onChange={(event) => onReason(event.target.value)}
                    placeholder="Explain what you checked and why you are recording this decision."
                  />
                </label>

                {extras.map((field) => (
                  <label key={field.name} className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                      {field.label} (required by this action)
                    </span>
                    {field.kind === "person" ? (
                      <select
                        className={controlClass}
                        value={extraValues[field.name] ?? ""}
                        onChange={(event) => onExtra(field.name, event.target.value)}
                      >
                        <option value="">Select an employee</option>
                        {people.map((person) => (
                          <option key={str(person.id)} value={str(person.id)}>
                            {nameOf(person.id)}
                          </option>
                        ))}
                      </select>
                    ) : field.kind === "condition" ? (
                      <select
                        className={controlClass}
                        value={extraValues[field.name] ?? ""}
                        onChange={(event) => onExtra(field.name, event.target.value)}
                      >
                        <option value="">Select a condition</option>
                        {ASSET_CONDITIONS.map((condition) => (
                          <option key={condition} value={condition}>
                            {humanize(condition)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.kind === "date" ? "date" : "text"}
                        className={controlClass}
                        value={extraValues[field.name] ?? ""}
                        onChange={(event) => onExtra(field.name, event.target.value)}
                      />
                    )}
                  </label>
                ))}

                {directoryError(extras, peopleError)}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={onSubmit}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ClipboardCheck className="size-4" strokeWidth={2} />
                    {busy ? "Recording…" : `Record ${humanize(action).toLowerCase()}`}
                  </button>
                  {!reasonReady && (
                    <p className="text-[12px] text-muted-foreground">
                      Enter a reason of at least three characters — the server rejects an approval action without one.
                    </p>
                  )}
                  {reasonReady && !extrasReady && (
                    <p className="text-[12px] text-muted-foreground">
                      Complete the details above — this action is rejected without them.
                    </p>
                  )}
                </div>

                {failure && (
                  <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                    {failure}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <SectionHeading
          title="Recorded history"
          description="Every action already written against this record, oldest first."
        />
        {!item.resource ? (
          <p className="text-sm text-muted-foreground">
            History is unavailable because this item&apos;s work area could not be matched to a workflow definition.
          </p>
        ) : history.error ? (
          <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {history.error}
          </p>
        ) : history.loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading the recorded history…
          </p>
        ) : events.length === 0 ? (
          <StateBlock
            tone="empty"
            icon={History}
            title="No history has been recorded yet"
            description="Actions taken on this record will appear here with their reason."
          />
        ) : (
          <ol className="divide-y divide-border">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{humanize(event.action)}</p>
                  {event.reason && <p className="mt-1 text-[12px] text-muted-foreground">{event.reason}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {event.status && <StatusPill tone={statusTone(event.status)}>{humanize(event.status)}</StatusPill>}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {dateLabel(event.createdAt, "No date recorded")}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Surface>
  );
}

/** Surfaces a directory failure only when a person has to be chosen for the action. */
function directoryError(extras: ExtraField[], peopleError: string) {
  if (!peopleError || !extras.some((field) => field.kind === "person")) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
      {peopleError}
    </p>
  );
}
