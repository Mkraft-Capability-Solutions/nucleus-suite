"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, getData, type Employee, type Translate } from "../workspaceHttp";
import type { Establishment, FairnessView, InterviewOverview, Loadable, PipelineBoard, ReferralLedger, RequisitionRegister } from "./types";

export const NS = "components.Workspace.RecruitmentView";

type Sources = {
  board: Loadable<PipelineBoard>;
  referrals: Loadable<ReferralLedger>;
  interviews: Loadable<InterviewOverview>;
  fairness: Loadable<FairnessView>;
  establishment: Loadable<Establishment>;
  register: Loadable<RequisitionRegister>;
  people: Loadable<Employee[]>;
};

const LOADING: Sources = {
  board: { status: "loading" },
  referrals: { status: "loading" },
  interviews: { status: "loading" },
  fairness: { status: "loading" },
  establishment: { status: "loading" },
  register: { status: "loading" },
  people: { status: "loading" },
};

async function settle<T>(promise: Promise<T>, fallback: string): Promise<Loadable<T>> {
  try {
    return { status: "ready", data: await promise };
  } catch (error) {
    return { status: "error", message: errorMessage(error, fallback) };
  }
}

async function fetchSources(t: Translate, signal: AbortSignal): Promise<Sources> {
  const failed = t(`${NS}.text_load_failed`, "This section could not be loaded.");
  const [board, referrals, interviews, fairness, establishment, register, people] = await Promise.all([
    settle(getData<PipelineBoard>("/api/v1/talent-pipeline?view=board", failed, signal), failed),
    settle(getData<ReferralLedger>("/api/v1/talent-pipeline?view=referrals", failed, signal), failed),
    settle(getData<InterviewOverview>("/api/v1/talent-pipeline?view=interviews", failed, signal), failed),
    settle(getData<FairnessView>("/api/v1/talent-pipeline?view=fairness", failed, signal), failed),
    settle(getData<Establishment>("/api/v1/establishment", failed, signal), failed),
    settle(getData<RequisitionRegister>("/api/v1/requisition-register", failed, signal), failed),
    settle(getData<Employee[]>("/api/v1/people?pageSize=100", failed, signal), failed),
  ]);
  return { board, referrals, interviews, fairness, establishment, register, people };
}

/**
 * Loads every source the recruitment workspace shows. Each source settles on its own, so one failing
 * endpoint shows its own error while the rest of the screen still renders real data.
 */
export function useRecruitmentData(t: Translate) {
  const [sources, setSources] = useState<Sources>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchSources(t, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setSources(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [t, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...sources, reload };
}
