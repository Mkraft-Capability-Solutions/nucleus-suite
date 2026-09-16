"use client";

/**
 * S4 — Talent Acquisition Command.
 *
 * Reads `/api/v1/cockpits/talent-acquisition-command`. The funnel and the
 * offer bridge are counted from recorded application stages; candidate
 * experience has no instrument in this platform and says so rather than
 * plotting a score (DESIGN_SYSTEM.md section 9).
 */

import type { ReactNode } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  ClipboardList,
  FileSignature,
  MessageSquareOff,
  Timer,
  Users,
} from "lucide-react";
import { ConversionFunnel, WaterfallBridge } from "../cockpit-charts";
import type { Column } from "../page-primitives";
import {
  DataTable,
  PageIntro,
  SectionHeading,
  StateBlock,
  StatTile,
  StatusPill,
  Surface,
} from "../page-primitives";
import { useLive } from "../workforce/records";

type FunnelStage = { label: string; value: number };
type BridgeItem = { label: string; value: number; kind: "base" | "delta" | "total" };
type StageBreakdownRow = { stage: string; label: string; count: number; terminal: boolean };

type Payload = {
  data?: {
    kpis: {
      openRequisitions: number | null;
      openRequisitionsNote: string;
      activeCandidates: number | null;
      activeCandidatesNote: string;
      offersOutstanding: number | null;
      offersOutstandingNote: string;
      timeToHireDays: number | null;
      timeToHireNote: string;
      activePostings: number | null;
    };
    funnel: {
      stages: FunnelStage[];
      conversions: Array<{ label: string; percent: number | null }>;
      terminal: number;
      total: number;
      available: boolean;
      message?: string;
      origin: string;
      note: string;
    };
    bridge: { items: BridgeItem[]; available: boolean; message?: string; origin: string; note: string };
    candidateExperience: { available: false; message: string; detail: string };
    stageBreakdown: { rows: StageBreakdownRow[]; available: boolean; message?: string; origin: string };
    unavailableSources: Array<{ name: string; message: string }>;
  };
};

function figure(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toLocaleString();
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] leading-[18px] text-muted-foreground">{children}</p>;
}

export function TalentAcquisitionCommandCockpit() {
  const { data, loading, error } = useLive<Payload>("/api/v1/cockpits/talent-acquisition-command");
  const payload = data?.data;

  const stageColumns: Column<StageBreakdownRow>[] = [
    {
      key: "stage",
      header: "Recorded stage",
      render: (row) => <span className="text-foreground">{row.label}</span>,
    },
    {
      key: "kind",
      header: "Kind",
      render: (row) => (
        <StatusPill tone={row.terminal ? "neutral" : "info"} dot>
          {row.terminal ? "Ended" : "In flow"}
        </StatusPill>
      ),
    },
    {
      key: "count",
      header: "Applications",
      align: "right",
      render: (row) => <span className="font-mono tabular-nums text-foreground">{row.count}</span>,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px]">
      <PageIntro
        eyebrow="S4 · Talent Acquisition Command"
        title="Where the pipeline actually stands."
        description="Requisition load, the recruitment funnel counted from recorded application stages, and what happens between an offer and a joining."
        action={
          payload ? (
            <StatusPill tone="info" dot>
              {figure(payload.funnel.total)} application(s) read
            </StatusPill>
          ) : undefined
        }
      />

      {error ? (
        <Surface>
          <StateBlock tone="error" icon={AlertTriangle} title="This cockpit could not be loaded" description={error} />
        </Surface>
      ) : loading || !payload ? (
        <Surface>
          <StateBlock
            tone="loading"
            title="Loading talent acquisition command"
            description="Reading the applications, requisitions and postings feeds."
          />
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Open requisitions"
              value={figure(payload.kpis.openRequisitions)}
              icon={ClipboardList}
              tone="primary"
              hint={payload.kpis.openRequisitionsNote}
            />
            <StatTile
              label="Active candidates"
              value={figure(payload.kpis.activeCandidates)}
              icon={Users}
              tone="info"
              hint={payload.kpis.activeCandidatesNote}
            />
            <StatTile
              label="Offers outstanding"
              value={figure(payload.kpis.offersOutstanding)}
              icon={FileSignature}
              tone="warning"
              hint={payload.kpis.offersOutstandingNote}
            />
            <StatTile
              label="Time to hire"
              value={payload.kpis.timeToHireDays === null ? "Not derivable" : `${payload.kpis.timeToHireDays}d`}
              icon={Timer}
              tone="neutral"
              hint={payload.kpis.timeToHireNote}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Surface>
              <SectionHeading
                title="Recruitment funnel"
                description="Applied through to joined, with stage-over-stage conversion."
              />
              {payload.funnel.available ? (
                <>
                  <ConversionFunnel
                    stages={payload.funnel.stages}
                    emptyTitle="No applications recorded"
                    emptyNote="Stages populate once applications are received against a requisition."
                  />
                  <Note>Source: {payload.funnel.origin}. {payload.funnel.note}</Note>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={BriefcaseBusiness}
                  title="Applications are unavailable"
                  description={payload.funnel.message}
                />
              )}
            </Surface>

            <Surface>
              <SectionHeading
                title="Offer to joining"
                description="Where the offer base goes, decomposed by recorded stage."
                action={<StatusPill tone="warning">No decline reasons captured</StatusPill>}
              />
              {payload.bridge.available ? (
                <>
                  <WaterfallBridge
                    items={payload.bridge.items}
                    emptyTitle="No application has reached an offer"
                    emptyNote="The bridge is drawn once at least one application is recorded at offer review or beyond."
                  />
                  <Note>Source: {payload.bridge.origin}. {payload.bridge.note}</Note>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={FileSignature}
                  title="Offer data is unavailable"
                  description={payload.bridge.message}
                />
              )}
            </Surface>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Surface>
              <SectionHeading
                title="Candidate experience"
                description="Comparison of candidate CSAT across the hiring journey."
              />
              <StateBlock
                tone="empty"
                icon={MessageSquareOff}
                title={payload.candidateExperience.message}
                description={payload.candidateExperience.detail}
              />
            </Surface>

            <Surface>
              <SectionHeading
                title="Applications by recorded stage"
                description="The counts the funnel and the bridge are built from."
              />
              {payload.stageBreakdown.available ? (
                <>
                  <DataTable<StageBreakdownRow>
                    columns={stageColumns}
                    rows={payload.stageBreakdown.rows}
                    rowKey={(row) => row.stage}
                    minWidth={480}
                    caption="Applications by recorded stage"
                    empty={
                      <StateBlock
                        tone="empty"
                        icon={BriefcaseBusiness}
                        title="No applications recorded"
                        description="Nothing has been submitted against a requisition yet."
                      />
                    }
                  />
                  <Note>
                    Source: {payload.stageBreakdown.origin}. An application marked ended no longer records how far it
                    reached, which is why {payload.funnel.terminal} of them sit at Applied in the funnel above.
                  </Note>
                </>
              ) : (
                <StateBlock
                  tone="empty"
                  icon={BriefcaseBusiness}
                  title="Applications are unavailable"
                  description={payload.stageBreakdown.message}
                />
              )}
            </Surface>
          </div>

          {payload.unavailableSources.length > 0 && (
            <Surface className="mt-4">
              <SectionHeading
                title="Feeds this cockpit could not read"
                description="Listed so nothing on this page is mistaken for a complete picture."
              />
              <ul className="space-y-2">
                {payload.unavailableSources.map((entry) => (
                  <li key={entry.name} className="flex min-w-0 flex-wrap items-start gap-2 text-[13px]">
                    <StatusPill tone="warning">{entry.name}</StatusPill>
                    <span className="min-w-0 flex-1 text-muted-foreground">{entry.message}</span>
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
