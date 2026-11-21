"use client";

import { useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronRight, Ellipsis, Grid2x2, History, PanelLeftClose, Pencil, Search, X } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { canViewNavigationDomain as canViewDomainJs, canViewNavigationItem as canViewItemJs } from "@/lib/navigation-access";
import { getNavigationDomains } from "@/lib/workspace-navigation";
import { Alert, Button, Drawer, cx, theme, ui } from "@/design/redesign/ui";
import { usePreference } from "./quick-actions";
import { AREAS, DEFAULT_RAIL, MAX_RAIL, RECENT_KEY, areaFor, defaultOpenGroup, displayLabel, mergeGroups, pushRecent, railAreas, type PanelItem } from "./side-nav";
import styles from "./SideNav.module.css";

/**
 * Redesigned side navigation: a narrow rail of areas (icon above a short label) with "More" for the
 * rest, and beside it a panel listing the selected area's screens. Primary navigation is the rail;
 * the panel is secondary. Each person chooses which areas sit on the rail (Customise menu).
 */

const canViewDomain = canViewDomainJs as (domainId: string, isModuleAllowed: unknown, user: unknown) => boolean;
const canViewItem = canViewItemJs as (item: { id: string; targetTab?: string }, isModuleAllowed: unknown, user: unknown, isNavItemEnabled: (id: string) => boolean) => boolean;

type NavDomain = { id: string; label: string; groups: Array<{ heading: string; items: Array<{ id: string; label: string; targetTab?: string }> }> };
type AuthShape = {
  user?: { role?: string; id?: string; email?: string } | null;
  isModuleAllowed: unknown;
  isNavItemEnabled: (id: string) => boolean;
};

function useAreas() {
  const { user, isModuleAllowed } = useAuth() as unknown as AuthShape;
  const allowed = useMemo(() => AREAS.filter((area) => canViewDomain(area.id, isModuleAllowed, user)), [isModuleAllowed, user]);
  const preference = usePreference<string[]>("rail_items");
  const { rail, more } = railAreas(preference.value, allowed);
  return { allowed, rail, more, pinnedIds: rail.map((area) => area.id), save: preference.save };
}

export function SideRail({ activeDomain, onSelectDomain, onOpenModules }: { activeDomain: string; onSelectDomain: (id: string) => void; onOpenModules: () => void }) {
  const areas = useAreas();
  const [customising, setCustomising] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const active = areaFor(activeDomain);
  const activeInMore = areas.more.some((area) => area.id === active);

  return (
    <nav className={cx(theme.scope, styles.rail)} aria-label="Areas" data-module="shell-nav">
      <button type="button" className={styles.logo} onClick={() => onSelectDomain("dashboard")} aria-label="Nucleus home page">
        <BrandLogo size={32} className={styles.logoImage} />
      </button>
      <ul className={styles.railList}>
        {areas.rail.map((area) => (
          <li key={area.id}>
            <button type="button" className={styles.railItem} aria-current={active === area.id ? "page" : undefined} onClick={() => onSelectDomain(area.id)}>
              <span className={styles.railIcon}><area.icon aria-hidden="true" /></span>
              <span className={styles.railLabel}>{area.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.railFoot}>
        <Popover.Root open={moreOpen} onOpenChange={setMoreOpen}>
          <Popover.Trigger className={styles.railItem} aria-current={activeInMore ? "page" : undefined}>
            <span className={styles.railIcon}><Ellipsis aria-hidden="true" /></span>
            <span className={styles.railLabel}>More</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner className={cx(theme.scope, ui.menuPositioner)} side="right" align="end" sideOffset={8}>
              <Popover.Popup className={cx(ui.menu, styles.morePanel)}>
                {areas.more.map((area) => (
                  <button key={area.id} type="button" className={ui.menuItem} onClick={() => { setMoreOpen(false); onSelectDomain(area.id); }}>
                    <area.icon aria-hidden="true" />{area.label}
                  </button>
                ))}
                {areas.more.length > 0 && <div className={ui.menuSeparator} role="separator" />}
                <button type="button" className={ui.menuItem} onClick={() => { setMoreOpen(false); onOpenModules(); }}>
                  <Grid2x2 aria-hidden="true" /><span className={styles.grow}>All modules</span><kbd className={styles.kbd}>Alt M</kbd>
                </button>
                <div className={ui.menuSeparator} role="separator" />
                <button type="button" className={ui.menuItem} onClick={() => { setMoreOpen(false); setCustomising(true); }}>
                  <Pencil aria-hidden="true" />Customise menu
                </button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {customising && <CustomiseRail onClose={() => setCustomising(false)} areas={areas} />}
    </nav>
  );
}

function CustomiseRail({ onClose, areas }: { onClose: () => void; areas: ReturnType<typeof useAreas> }) {
  const [selected, setSelected] = useState<string[]>(areas.pinnedIds);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= MAX_RAIL ? current : [...current, id]);
  async function save(ids: string[]) {
    setBusy(true);
    try { await areas.save(ids); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Your menu could not be saved."); } finally { setBusy(false); }
  }
  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Customise menu"
      description={`Choose up to ${MAX_RAIL} areas for the side menu, in the order you pick them. The others stay under More.`}
      footer={<>
        <Button variant="ghost" onClick={() => void save(DEFAULT_RAIL.filter((id) => areas.allowed.some((area) => area.id === id)))} disabled={busy}>Use the defaults</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={() => void save(selected)} disabled={selected.length === 0}>Save</Button>
      </>}>
      <div className={styles.customise}>
        {error && <Alert tone="danger">{error}</Alert>}
        <ul className={styles.customiseList}>
          {areas.allowed.map((area) => {
            const index = selected.indexOf(area.id);
            const disabled = index < 0 && selected.length >= MAX_RAIL;
            return (
              <li key={area.id}>
                <label className={cx(styles.customiseRow, disabled && styles.disabled)}>
                  <input type="checkbox" checked={index >= 0} disabled={disabled} onChange={() => toggle(area.id)} />
                  <area.icon size={16} aria-hidden="true" />
                  <span>{area.label}</span>
                  {index >= 0 && <span className={styles.order} aria-label={`Position ${index + 1}`}>{index + 1}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Drawer>
  );
}

function readRecent(): Record<string, string[]> {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/**
 * The selected area's screens. Groups are folded except the one holding the open screen, so the
 * panel starts short; each folded group shows how many screens it holds. Recently opened screens
 * of the area sit on top. A filter box searches every group.
 */
export function SidePanel({ activeDomain, activeItem, onOpenItem, onCollapse }: { activeDomain: string; activeItem: string | null; onOpenItem: (id: string) => void; onCollapse: () => void }) {
  const { t } = useTranslation() as unknown as { t: (key: string) => string };
  const { user, isModuleAllowed, isNavItemEnabled } = useAuth() as unknown as AuthShape;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  /** Groups the person opened or closed themselves, per area ("area:heading" → open). */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [recent, setRecent] = useState<Record<string, string[]>>(readRecent);
  const area = areaFor(activeDomain);
  const domain = (getNavigationDomains() as NavDomain[]).find((entry) => entry.id === area);
  const label = AREAS.find((entry) => entry.id === area)?.label ?? domain?.label ?? "";
  const allGroups = mergeGroups((domain?.groups ?? []).map((group) => ({
    heading: displayLabel(t(group.heading)),
    items: group.items
      .filter((item) => canViewItem(item, isModuleAllowed, user, isNavItemEnabled))
      .map((item) => ({ ...item, label: displayLabel(t(item.label)) })),
  })));
  const needle = query.trim().toLowerCase();
  const groups = needle
    ? allGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(needle) || group.heading.toLowerCase().includes(needle)) })).filter((group) => group.items.length > 0)
    : allGroups;
  const defaultOpen = defaultOpenGroup(allGroups, activeItem);
  const byId = new Map(allGroups.flatMap((group) => group.items.map((item) => [item.id, item] as const)));
  const recentItems = needle ? [] : (recent[area] ?? []).map((id) => byId.get(id)).filter((item): item is PanelItem => Boolean(item));
  const total = byId.size;

  const open = (id: string) => {
    const next = pushRecent(recent, area, id);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage blocked: recents last for this page only */ }
    onOpenItem(id);
  };
  const itemButton = (item: PanelItem) => (
    <button type="button" className={styles.item} aria-current={activeItem === item.id ? "page" : undefined} onClick={() => open(item.id)}>{item.label}</button>
  );

  return (
    <aside className={cx(theme.scope, styles.panel)} aria-label={`${label} screens`}>
      <div className={styles.panelHead}>
        {searching ? (
          <div className={styles.filterBox}>
            <Search aria-hidden="true" />
            <input autoFocus type="search" className={styles.filterInput} placeholder={`Find in ${label}`} aria-label={`Find a screen in ${label}`} value={query}
              onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setSearching(false); } }} />
            <button type="button" className={styles.headButton} aria-label="Stop filtering" onClick={() => { setQuery(""); setSearching(false); }}><X aria-hidden="true" /></button>
          </div>
        ) : (
          <>
            <div className={styles.panelTitleBlock}>
              <h2 className={styles.panelTitle}>{label}</h2>
              <span className={styles.panelCount}>{total} {total === 1 ? "screen" : "screens"}</span>
            </div>
            <button type="button" className={styles.headButton} aria-label={`Find a screen in ${label}`} title="Find a screen" onClick={() => setSearching(true)}><Search aria-hidden="true" /></button>
            <button type="button" className={styles.headButton} aria-label="Hide the screens panel" title="Hide the screens panel" onClick={onCollapse}><PanelLeftClose aria-hidden="true" /></button>
          </>
        )}
      </div>
      <div className={styles.panelBody}>
        {recentItems.length > 0 && (
          <section className={styles.recent} aria-labelledby="side-recent">
            <h3 id="side-recent" className={styles.recentTitle}><History aria-hidden="true" />Recent</h3>
            <ul className={styles.items}>
              {recentItems.map((item) => <li key={`recent-${item.id}`}>{itemButton(item)}</li>)}
            </ul>
          </section>
        )}
        {groups.length === 0 && <p className={styles.empty}>{needle ? "No screens match." : "No screens available in this area."}</p>}
        {groups.map((group, index) => {
          const key = `${area}:${group.heading}`;
          const allIndex = allGroups.findIndex((entry) => entry.heading === group.heading);
          const isOpen = Boolean(needle) || (toggled[key] ?? allIndex === defaultOpen);
          const holdsActive = group.items.some((item) => item.id === activeItem);
          return (
            <section key={`${index}-${group.heading}`} className={cx(styles.group, isOpen && styles.groupOpen)}>
              <button type="button" className={cx(styles.groupHead, holdsActive && styles.groupHeadActive)} aria-expanded={isOpen}
                onClick={() => setToggled((value) => ({ ...value, [key]: !isOpen }))}>
                <ChevronRight aria-hidden="true" className={cx(styles.chevron, isOpen && styles.chevronOpen)} />
                <span className={styles.groupName}>{group.heading}</span>
                <span className={styles.groupCount} aria-label={`${group.items.length} screens`}>{group.items.length}</span>
              </button>
              {isOpen && <ul className={cx(styles.items, styles.groupItems)}>{group.items.map((item, position) => <li key={`${position}-${item.id}`}>{itemButton(item)}</li>)}</ul>}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
