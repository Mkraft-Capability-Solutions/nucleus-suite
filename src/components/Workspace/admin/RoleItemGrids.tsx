"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { PageCategory, UiCardDefinition, UiPageDefinition } from "@/lib/access/ui-access-catalog";
import type { PermissionEntry, Translate } from "./adminApi";
import { Switch } from "./AdminParts";
import { cardDescription, cardName, categoryName, pageDescription, pageName, permissionDomain, riskLabel } from "./uiLabels";
import styles from "./Admin.module.css";

const NS = "components.Workspace.RoleItemGrids";

function missing(required: readonly string[], held: ReadonlySet<string>, any: boolean): string[] {
  if (required.length === 0) return [];
  if (any) return required.some((key) => held.has(key)) ? [] : [...required];
  return required.filter((key) => !held.has(key));
}

function Missing({ t, keys }: { t: Translate; keys: string[] }) {
  if (keys.length === 0) return null;
  return (
    <span className={`${styles.badge} ${styles.badgeWarn}`} title={keys.join(", ")}>
      <AlertTriangle size={12} aria-hidden="true" />{t(`${NS}.text_needs`, "Data needs {permissions}", { permissions: keys.join(", ") })}
    </span>
  );
}

export function PageGrid({ t, pages, selected, held, query, disabled, onToggle }: {
  t: Translate; pages: UiPageDefinition[]; selected: ReadonlySet<string>; held: ReadonlySet<string>;
  query: string; disabled: boolean; onToggle: (key: string, next: boolean) => void;
}) {
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<PageCategory, UiPageDefinition[]>();
    for (const page of pages) {
      const text = `${pageName(t, page.key)} ${pageDescription(t, page.key)} ${page.key}`.toLowerCase();
      if (needle && !text.includes(needle)) continue;
      map.set(page.category, [...(map.get(page.category) ?? []), page]);
    }
    return [...map.entries()];
  }, [pages, query, t]);
  if (groups.length === 0) return <p className={styles.muted}>{t(`${NS}.text_no_match`, "Nothing matches your search.")}</p>;
  return (
    <>
      {groups.map(([category, list]) => (
        <div key={category}>
          <h4 className={styles.groupTitle}>{categoryName(t, category)}</h4>
          <div className={styles.itemGrid}>
            {list.map((page) => {
              const on = selected.has(page.key);
              return (
                <div key={page.key} className={`${styles.item} ${on ? styles.itemOn : ""}`}>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{pageName(t, page.key)}</span>
                    <span className={styles.itemDesc}>{pageDescription(t, page.key)}</span>
                    {on && <Missing t={t} keys={missing(page.requiredPermissions, held, false)} />}
                  </span>
                  <Switch checked={on} disabled={disabled} onChange={(next) => onToggle(page.key, next)} label={pageName(t, page.key)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export function CardGrid({ t, cards, selected, held, query, disabled, onToggle }: {
  t: Translate; cards: UiCardDefinition[]; selected: ReadonlySet<string>; held: ReadonlySet<string>;
  query: string; disabled: boolean; onToggle: (key: string, next: boolean) => void;
}) {
  const needle = query.trim().toLowerCase();
  const list = cards.filter((card) => !needle || `${cardName(t, card.key)} ${cardDescription(t, card.key)}`.toLowerCase().includes(needle));
  if (list.length === 0) return <p className={styles.muted}>{t(`${NS}.text_no_match`, "Nothing matches your search.")}</p>;
  return (
    <div className={styles.itemGrid}>
      {list.map((card) => {
        const on = selected.has(card.key);
        return (
          <div key={card.key} className={`${styles.item} ${on ? styles.itemOn : ""}`}>
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>{cardName(t, card.key)}</span>
              <span className={styles.itemDesc}>{cardDescription(t, card.key)}</span>
              {on && <Missing t={t} keys={missing(card.requiredPermissions, held, true)} />}
            </span>
            <Switch checked={on} disabled={disabled} onChange={(next) => onToggle(card.key, next)} label={cardName(t, card.key)} />
          </div>
        );
      })}
    </div>
  );
}

export function ActionGrid({ t, permissions, selected, query, disabled, onToggle }: {
  t: Translate; permissions: PermissionEntry[]; selected: ReadonlySet<string>; query: string;
  disabled: boolean; onToggle: (key: string, next: boolean) => void;
}) {
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<string, PermissionEntry[]>();
    for (const entry of permissions) {
      if (needle && !entry.key.toLowerCase().includes(needle)) continue;
      const domain = permissionDomain(entry.key);
      map.set(domain, [...(map.get(domain) ?? []), entry]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions, query]);
  if (permissions.length === 0) return <p className={styles.muted}>{t(`${NS}.text_no_permissions`, "No permissions are registered.")}</p>;
  if (groups.length === 0) return <p className={styles.muted}>{t(`${NS}.text_no_match`, "Nothing matches your search.")}</p>;
  return (
    <>
      {groups.map(([domain, list]) => (
        <div key={domain}>
          <h4 className={styles.groupTitle}><span className={styles.mono}>{domain}</span></h4>
          <div className={styles.itemGrid}>
            {list.map((entry) => {
              const on = selected.has(entry.key);
              const tone = entry.risk === "restricted" ? styles.badgeFlag : entry.risk === "high" || entry.risk === "elevated" ? styles.badgeWarn : styles.badgeInfo;
              return (
                <div key={entry.key} className={`${styles.item} ${on ? styles.itemOn : ""}`}>
                  <span className={styles.itemText}>
                    <span className={`${styles.itemTitle} ${styles.mono}`}>{entry.key}</span>
                    <span className={`${styles.badge} ${tone}`}>{riskLabel(t, entry.risk)}</span>
                  </span>
                  <Switch checked={on} disabled={disabled} onChange={(next) => onToggle(entry.key, next)} label={entry.key} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
