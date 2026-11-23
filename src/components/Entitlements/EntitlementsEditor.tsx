"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { EntitlementNode } from "@/lib/entitlements/tree";
import { entitlementLabel } from "@/lib/entitlements/tree";
import type { ConfigField, ConfigValues } from "@/lib/entitlements/types";
import styles from "./Entitlements.module.css";

export type EntitlementChange = { key: string; enabled?: boolean; config?: ConfigValues };
export type SaveResult = { tree?: EntitlementNode[]; error?: { message: string; details?: Array<{ field: string; issue: string }> } };

type Props = {
  tree: EntitlementNode[];
  /** platform: everything; tenant: features and settings inside sub-modules in the plan. */
  authority: "platform" | "tenant";
  save: (changes: EntitlementChange[]) => Promise<SaveResult>;
  intro?: string;
  /** Show the plan without letting the viewer change it. */
  readOnly?: boolean;
};

const TIER_LABEL = { core: "Core", standard: "Standard", addon: "Add-on" } as const;

function matchesQuery(node: EntitlementNode, query: string): boolean {
  if (!query) return true;
  const text = `${node.name} ${node.description} ${node.key}`.toLowerCase();
  return text.includes(query) || node.children.some((child) => matchesQuery(child, query));
}

/** Editor for one organisation's modules, sub-modules, features and their settings. */
export default function EntitlementsEditor({ tree: initialTree, authority, save, intro, readOnly = false }: Props) {
  const [tree, setTree] = useState(initialTree);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<SaveResult["error"] | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const searchId = useId();

  const byKey = useMemo(() => {
    const map = new Map<string, EntitlementNode>();
    const walk = (nodes: EntitlementNode[]) => nodes.forEach((node) => { map.set(node.key, node); walk(node.children); });
    walk(tree);
    return map;
  }, [tree]);

  const canToggle = (node: EntitlementNode) => {
    if (readOnly || node.locked) return false;
    if (authority === "platform") return true;
    if (node.scope !== "feature") return false;
    const parent = byKey.get(node.key.split(".").slice(0, 2).join("."));
    return Boolean(parent?.active);
  };

  const canConfigure = (node: EntitlementNode) => {
    if (readOnly || !node.fields.length) return false;
    if (authority === "platform") return true;
    const submodule = byKey.get(node.key.split(".").slice(0, 2).join("."));
    return Boolean(submodule?.active);
  };

  async function apply(changes: EntitlementChange[], key: string, done: string) {
    setBusyKey(key);
    setError(null);
    setStatus("");
    const result = await save(changes);
    setBusyKey(null);
    if (result.error) {
      setError(result.error);
      return false;
    }
    if (result.tree) setTree(result.tree);
    setStatus(done);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("nucleus:entitlements-changed"));
    return true;
  }

  const toggle = (node: EntitlementNode) =>
    apply([{ key: node.key, enabled: !node.enabled }], node.key, `${entitlementLabel(node.key)} switched ${node.enabled ? "off" : "on"}.`);

  const toggleExpanded = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const normalisedQuery = query.trim().toLowerCase();
  const visibleModules = tree.filter((node) => matchesQuery(node, normalisedQuery));

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        {intro && <p className={styles.intro}>{intro}</p>}
        <label htmlFor={searchId} className="visually-hidden" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Search modules
        </label>
        <input id={searchId} className={styles.search} type="search" placeholder="Search modules and features" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {error && (
        <div className={styles.alert} role="alert">
          {error.message}
          {error.details && error.details.length > 0 && (
            <ul>
              {error.details.map((detail) => (
                <li key={`${detail.field}-${detail.issue}`}>{detail.issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className={styles.status} role="status" aria-live="polite">{status}</p>

      {visibleModules.map((mod) => {
        const open = expanded.has(mod.key) || Boolean(normalisedQuery);
        return (
          <section key={mod.key} className={styles.module} aria-label={mod.name}>
            <div className={`${styles.row} ${styles.moduleRow}`}>
              <div className={styles.label}>
                <div className={styles.nameLine}>
                  <button type="button" className={styles.expand} aria-expanded={open} onClick={() => toggleExpanded(mod.key)}>
                    {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    <span className={styles.moduleName}>{mod.name}</span>
                  </button>
                  <span className={styles.badge}>{TIER_LABEL[mod.tier]}</span>
                  <StateBadge node={mod} />
                </div>
                <span className={styles.description}>{mod.description}</span>
              </div>
              <div className={styles.controls}>
                <Switch node={mod} disabled={!canToggle(mod) || busyKey !== null} onToggle={() => toggle(mod)} />
              </div>
            </div>
            {open && (
              <div className={styles.children}>
                {mod.children.filter((sub) => matchesQuery(sub, normalisedQuery)).map((sub) => (
                  <div key={sub.key}>
                    <NodeRow
                      node={sub}
                      className={styles.subRow}
                      canToggle={canToggle(sub) && busyKey === null}
                      canConfigure={canConfigure(sub)}
                      settingsOpen={openSettings === sub.key}
                      onToggle={() => toggle(sub)}
                      onSettings={() => setOpenSettings(openSettings === sub.key ? null : sub.key)}
                    />
                    {openSettings === sub.key && (
                      <ConfigForm
                        node={sub}
                        busy={busyKey === sub.key}
                        onCancel={() => setOpenSettings(null)}
                        onSave={(config) => apply([{ key: sub.key, config }], sub.key, `Settings for ${entitlementLabel(sub.key)} saved.`).then((ok) => ok && setOpenSettings(null))}
                      />
                    )}
                    {sub.children.map((feature) => (
                      <div key={feature.key}>
                        <NodeRow
                          node={feature}
                          className={styles.featureRow}
                          canToggle={canToggle(feature) && busyKey === null}
                          canConfigure={canConfigure(feature)}
                          settingsOpen={openSettings === feature.key}
                          onToggle={() => toggle(feature)}
                          onSettings={() => setOpenSettings(openSettings === feature.key ? null : feature.key)}
                        />
                        {openSettings === feature.key && (
                          <ConfigForm
                            node={feature}
                            busy={busyKey === feature.key}
                            onCancel={() => setOpenSettings(null)}
                            onSave={(config) => apply([{ key: feature.key, config }], feature.key, `Settings for ${entitlementLabel(feature.key)} saved.`).then((ok) => ok && setOpenSettings(null))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function StateBadge({ node }: { node: EntitlementNode }) {
  if (node.locked) return <span className={styles.badge}>Always on</span>;
  if (node.enabled && !node.active && node.blockedBy) {
    return <span className={`${styles.badge} ${styles.badgeWarn}`}>Inactive: needs {entitlementLabel(node.blockedBy)}</span>;
  }
  return null;
}

function Switch({ node, disabled, onToggle }: { node: EntitlementNode; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={node.enabled}
      aria-label={`${node.name}: ${node.enabled ? "on" : "off"}`}
      className={styles.switch}
      disabled={disabled}
      onClick={onToggle}
    />
  );
}

function NodeRow(props: {
  node: EntitlementNode;
  className: string;
  canToggle: boolean;
  canConfigure: boolean;
  settingsOpen: boolean;
  onToggle: () => void;
  onSettings: () => void;
}) {
  const { node } = props;
  return (
    <div className={`${styles.row} ${props.className}`}>
      <div className={styles.label}>
        <div className={styles.nameLine}>
          <span className={styles.name}>{node.name}</span>
          {node.scope === "feature" && <span className={styles.badge}>Feature</span>}
          <StateBadge node={node} />
        </div>
        <span className={styles.description}>{node.description}</span>
      </div>
      <div className={styles.controls}>
        {node.fields.length > 0 && (
          <button type="button" className={styles.linkButton} aria-expanded={props.settingsOpen} disabled={!props.canConfigure} onClick={props.onSettings}>
            Settings
          </button>
        )}
        <Switch node={node} disabled={!props.canToggle} onToggle={props.onToggle} />
      </div>
    </div>
  );
}

function ConfigForm({ node, busy, onSave, onCancel }: { node: EntitlementNode; busy: boolean; onSave: (config: ConfigValues) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ConfigValues>(node.config);
  const set = (key: string, value: ConfigValues[string]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <form
      className={styles.config}
      aria-label={`Settings for ${node.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      {node.fields.map((field) => (
        <Field key={field.key} field={field} value={draft[field.key]} onChange={(value) => set(field.key, value)} idPrefix={node.key} />
      ))}
      <div className={styles.actions}>
        <button type="submit" className={styles.buttonPrimary} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        <button type="button" className={styles.buttonSecondary} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ field, value, onChange, idPrefix }: { field: ConfigField; value: ConfigValues[string] | undefined; onChange: (value: ConfigValues[string]) => void; idPrefix: string }) {
  const id = `${idPrefix}-${field.key}`;
  const hint = field.description ? <span className={styles.fieldHint} id={`${id}-hint`}>{field.description}</span> : null;
  const describedBy = field.description ? `${id}-hint` : undefined;
  switch (field.type) {
    case "boolean":
      return (
        <div className={styles.field}>
          <label className={styles.option}>
            <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} aria-describedby={describedBy} />
            <span className={styles.fieldLabel}>{field.label}</span>
          </label>
          {hint}
        </div>
      );
    case "number":
      return (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={id}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
          </label>
          {hint}
          <input
            id={id}
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={field.min}
            max={field.max}
            step={1}
            value={typeof value === "number" ? value : ""}
            onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
            aria-describedby={describedBy}
          />
        </div>
      );
    case "select":
      return (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={id}>{field.label}</label>
          {hint}
          <select id={id} className={styles.input} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      );
    case "multiselect": {
      const selected = new Set(Array.isArray(value) ? value : []);
      return (
        <fieldset className={styles.field} style={{ border: 0, margin: 0, padding: 0 }} aria-describedby={describedBy}>
          <legend className={styles.fieldLabel} style={{ padding: 0 }}>{field.label}</legend>
          {hint}
          <div className={styles.options}>
            {field.options.map((option) => (
              <label key={option.value} className={styles.option}>
                <input
                  type="checkbox"
                  checked={selected.has(option.value)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(option.value);
                    else next.delete(option.value);
                    onChange(field.options.map((candidate) => candidate.value).filter((candidate) => next.has(candidate)));
                  }}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
  }
}
