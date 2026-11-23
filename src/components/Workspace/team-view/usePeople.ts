"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, invalidateGetRequest } from "@/lib/client-api";
import type { PersonItem } from "./data";

export type PeopleState =
  | { status: "loading" }
  | { status: "ready"; items: PersonItem[]; total: number | null }
  | { status: "error"; message: string };

const path = (search: string) => `/api/v1/people?${new URLSearchParams({ search, pageSize: "100" }).toString()}`;

/** Loads the permission-filtered people directory (first 100 matches for a server-side search). */
export function usePeople(search: string) {
  const [state, setState] = useState<PeopleState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getJson(path(search))
        .then((body) => {
          if (cancelled) return;
          const typed = body as { data?: PersonItem[]; meta?: { total?: number } } | null;
          setState(Array.isArray(typed?.data) ? { status: "ready", items: typed.data, total: typed.meta?.total ?? null } : { status: "error", message: "" });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "" });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, attempt]);

  const reload = useCallback(() => {
    invalidateGetRequest(path(search));
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, [search]);

  return { state, reload };
}
