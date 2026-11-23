"use client";

import { useMemo } from "react";
import { useApiResource } from "@/hooks/useApiResource";
import { useT } from "@/hooks/useT";
import { ACTION_NS, type OptionSourceId } from "@/lib/action-registry";

/**
 * Option list for a registry `reference` field, read from the real tenant API (never a constant list).
 * Loading, empty and error states are shown instead of options; time zones come from the runtime (Intl).
 */
type Option = { value: string; label: string };
type Row = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
const list = (payload: unknown): Row[] => {
  const data = (payload as { data?: unknown } | null)?.data;
  if (Array.isArray(data)) return data as Row[];
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as Row[]) : [];
};

const SOURCES: Record<Exclude<OptionSourceId, "timeZones">, { path: string; map: (row: Row) => Option }> = {
  employees: { path: "/api/v1/dossier-lookups/employees?pageSize=100", map: (r) => ({ value: str(r.id), label: str(r.name) }) },
  departments: { path: "/api/v1/dossier-lookups/departments?pageSize=100", map: (r) => ({ value: str(r.name), label: str(r.name) }) },
  locations: { path: "/api/v1/organization/locations", map: (r) => ({ value: str(r.code), label: `${str(r.name)} · ${str(r.code)}` }) },
  legalEntities: { path: "/api/v1/organization/legal-entities", map: (r) => ({ value: str(r.code), label: `${str(r.legal_name)} · ${str(r.code)}` }) },
  roles: { path: "/api/v1/workspace/lookups/roles", map: (r) => ({ value: str(r.code), label: str(r.name) }) },
  documentTypes: { path: "/api/v1/workspace/lookups/document-types", map: (r) => ({ value: str(r.id), label: str(r.name) }) },
  integrationCatalog: {
    path: "/api/v1/integrations/catalog",
    map: (r) => {
      const a = (r.attributes ?? {}) as Row;
      return { value: str(a.code), label: str(a.name) || str(a.code) };
    },
  },
};

function timeZones(): Option[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : ["UTC"];
  return zones.map((zone) => ({ value: zone, label: zone }));
}

type Props = { id: string; source: OptionSourceId; value: string; required?: boolean; disabled?: boolean; invalid?: boolean; describedBy?: string; onChange: (value: string) => void };

export default function ActionReferenceSelect({ id, source, value, required, disabled, invalid, describedBy, onChange }: Props) {
  const { t } = useT();
  const remote = source === "timeZones" ? null : SOURCES[source];
  const { state } = useApiResource<Option[]>(disabled ? null : remote?.path ?? null, (payload) => (remote ? list(payload).map(remote.map).filter((o) => o.value) : []));
  const options = useMemo(() => (source === "timeZones" ? timeZones() : state.status === "ready" ? state.data : []), [source, state]);

  if (!disabled && state.status === "error") return <p className="field-note" role="alert" id={describedBy}>{state.message || t(`${ACTION_NS}.text_options_failed`, "The options could not be loaded.")}</p>;
  const loading = !disabled && source !== "timeZones" && state.status === "loading";
  const empty = !disabled && !loading && options.length === 0;

  return (
    <select id={id} value={value} required={required} disabled={disabled || loading || empty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)}>
      <option value="">
        {loading ? t(`${ACTION_NS}.text_options_loading`, "Loading options…") : empty ? t(`${ACTION_NS}.text_options_empty`, "No records available yet") : t(`${ACTION_NS}.content_text_5`, "Select")}
      </option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
