"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Popover } from "@base-ui/react/popover";
import { Menu } from "@base-ui/react/menu";
import { Bell, Keyboard, LayoutGrid, LogOut, MessageSquare, PanelLeftOpen, Search, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { useTranslation } from "@/context/I18nContext";
import { appearances } from "@/lib/appearance";
import { ACCENTS } from "@/lib/accent";
import { useAccent } from "@/lib/use-accent";
import UiModeSwitch from "@/components/UiModeSwitch";
import { Avatar, cx, theme, ui } from "@/design/redesign/ui";
import { CustomiseQuickActions, QuickActionsMenu, useQuickActions } from "./QuickActions";
import styles from "./Shell.module.css";

type SearchResult = { id: string; type: string; title: string; subtitle?: string; tag?: string; targetTab?: string; domain?: string; subFeature?: string };
type Notification = { id: string; attributes: { title?: string; body?: string; read?: boolean | string }; created_at: string };

type Props = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onTabChange: (tab: string, domain?: string, sub?: string) => void;
  openNav: (navId: string) => void;
  onOpenAssistant?: () => void;
  onToggleMessages?: () => void;
  assistantOpen?: boolean;
  messagesOpen?: boolean;
  /** Opens the all-modules navigator (Alt+M). Shown as a button only where the side menu is hidden. */
  onOpenModules?: () => void;
  /** Present while the screens panel is hidden: shows it again. */
  onShowScreens?: () => void;
};

type AuthShape = {
  user?: { name?: string; email?: string; role?: string } | null;
  logout: () => void;
  tenantAccess?: { tenant?: { id?: string; name?: string }; memberships?: Array<{ id: string; name: string }>; platformAdmin?: boolean } | null;
  switchTenant: (id: string) => Promise<void>;
};

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

async function getData<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return (body?.data ?? null) as T | null;
}

/**
 * Redesigned top bar: search first, then the few actions used all day (quick actions, assistant,
 * messages, notifications) and one profile menu that holds everything else (organisation,
 * interface, appearance, language, access, settings, sign out).
 */
export default function TopBar({ searchQuery, onSearchChange, onTabChange, openNav, onOpenAssistant, onToggleMessages, assistantOpen, messagesOpen, onOpenModules, onShowScreens }: Props) {
  const { user, logout, tenantAccess, switchTenant } = useAuth() as unknown as AuthShape;
  const { appearance, setAppearance } = useAppearance() as { appearance: { id: string }; setAppearance: (id: string) => void };
  const [accent, setAccent] = useAccent();
  const { locale, setLocale, supportedLanguages } = useTranslation() as unknown as { locale: string; setLocale: (code: string) => void; supportedLanguages: Array<{ code: string; nativeName: string; englishName?: string; name?: string }> };
  const quick = useQuickActions(openNav);
  const [customising, setCustomising] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifications = useSWR("/api/v1/notifications", (url: string) => getData<{ items: Notification[]; unread: number }>(url), { refreshInterval: 60_000, revalidateOnFocus: false });
  const role = String(user?.role ?? "").toUpperCase();

  // Ctrl/⌘+K focuses search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search across screens, forms, people and documents as the user types.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    let active = true;
    const timer = setTimeout(async () => {
      const data = await getData<SearchResult[]>(`/api/v1/search?q=${encodeURIComponent(query)}`);
      if (!active) return;
      setResults(Array.isArray(data) ? data.slice(0, 8) : []);
      setResultsOpen(true);
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [searchQuery]);

  function openResult(item: SearchResult) {
    if (item.targetTab) onTabChange(item.targetTab, item.domain, item.subFeature);
    else if (item.type === "employee") onTabChange("people_core", "core_hr", "person_record");
    else if (item.type === "document") onTabChange("document_vault", "core_hr", "document_vault");
    setResultsOpen(false);
  }

  async function markRead(id: string) {
    await fetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: "POST", credentials: "same-origin" }).catch(() => null);
    void notifications.mutate();
  }

  const unread = notifications.data?.unread ?? 0;
  const showResults = resultsOpen && searchQuery.trim().length >= 2 && results.length > 0;

  return (
    <header className={cx(theme.scope, styles.topBar)} data-module="shell" role="banner">
      {onOpenModules && (
        <button type="button" className={cx(ui.button, ui.ghost, styles.iconTrigger, styles.showNarrow)} aria-label="All modules" title="All modules" onClick={onOpenModules}>
          <LayoutGrid aria-hidden="true" />
        </button>
      )}
      {onShowScreens && (
        <button type="button" className={cx(ui.button, ui.secondary, styles.iconTrigger, styles.showScreens)} aria-label="Show the screens panel" title="Show the screens panel" onClick={onShowScreens}>
          <PanelLeftOpen aria-hidden="true" />
        </button>
      )}
      <div className={styles.searchWrap}>
        <Search aria-hidden="true" className={styles.searchIcon} />
        <input
          ref={searchRef}
          type="search"
          className={styles.searchInput}
          placeholder="Search people, screens and documents"
          aria-label="Search"
          value={searchQuery}
          onChange={(event) => { onSearchChange(event.target.value); if (event.target.value.trim().length < 2) setResultsOpen(false); }}
          onFocus={() => { if (results.length) setResultsOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") setResultsOpen(false); }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls="shell-search-results"
        />
        <kbd className={styles.kbd} aria-hidden="true">Ctrl K</kbd>
        {showResults && (
          <ul id="shell-search-results" className={styles.results} role="listbox" aria-label="Search results">
            {results.map((item, index) => (
              <li key={`${item.type}-${item.id}-${index}`} role="option" aria-selected={false}>
                <button type="button" className={styles.result} onMouseDown={(event) => event.preventDefault()} onClick={() => openResult(item)}>
                  <span className={styles.resultText}><span className={styles.resultTitle}>{item.title.replace(/^§\s*/, "")}</span>{item.subtitle && <span className={styles.resultSub}>{item.subtitle}</span>}</span>
                  <span className={styles.resultType}>{item.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.barActions}>
        <QuickActionsMenu quick={quick} onCustomise={() => setCustomising(true)} />
        {onOpenAssistant && (
          <button type="button" className={cx(ui.button, ui.ghost, styles.iconTrigger)} aria-label="Nucleus assistant" title="Nucleus assistant" aria-pressed={assistantOpen} onClick={onOpenAssistant}>
            <Sparkles aria-hidden="true" />
          </button>
        )}
        {onToggleMessages && (
          <button type="button" className={cx(ui.button, ui.ghost, styles.iconTrigger)} aria-label="Messages" title="Messages" aria-pressed={messagesOpen} onClick={onToggleMessages}>
            <MessageSquare aria-hidden="true" />
          </button>
        )}

        <Menu.Root>
          <Menu.Trigger className={cx(ui.button, ui.ghost, styles.iconTrigger)} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications">
            <Bell aria-hidden="true" />
            {unread > 0 && <span className={styles.count}>{unread > 99 ? "99+" : unread}</span>}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className={cx(theme.scope, ui.menuPositioner)} align="end" sideOffset={6}>
              <Menu.Popup className={cx(ui.menu, styles.menuWide)}>
                <div className={styles.menuHeading}>Notifications</div>
                {(notifications.data?.items ?? []).length === 0 ? (
                  <div className={styles.menuEmpty}>You have no notifications.</div>
                ) : (notifications.data?.items ?? []).slice(0, 8).map((item) => {
                  const read = item.attributes.read === true || item.attributes.read === "true";
                  return (
                    <Menu.Item key={item.id} className={cx(ui.menuItem, styles.notification)} onClick={() => { if (!read) void markRead(item.id); }}>
                      {!read && <span className={styles.unreadDot} aria-label="Unread" />}
                      <span className={styles.resultText}><span className={styles.resultTitle}>{item.attributes.title ?? "Notification"}</span>{item.attributes.body && <span className={styles.resultSub}>{item.attributes.body}</span>}</span>
                    </Menu.Item>
                  );
                })}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Popover.Root>
          <Popover.Trigger className={styles.profileTrigger} aria-label="Your profile and settings">
            <Avatar name={user?.name ?? "User"} size={32} />
            <span className={styles.profileText}><span className={styles.profileName}>{user?.name ?? "User"}</span><span className={styles.profileOrg}>{tenantAccess?.tenant?.name ?? ""}</span></span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner className={cx(theme.scope, ui.menuPositioner)} align="end" sideOffset={6}>
              <Popover.Popup className={cx(ui.menu, styles.profilePanel)}>
                <div className={styles.profileHead}>
                  <Avatar name={user?.name ?? "User"} size={40} />
                  <span className={styles.resultText}><span className={styles.resultTitle}>{user?.name}</span><span className={styles.resultSub}>{user?.email}</span></span>
                </div>
                {(tenantAccess?.memberships?.length ?? 0) > 1 && (
                  <label className={styles.profileField}>
                    <span>Organisation</span>
                    <select className={ui.select} value={tenantAccess?.tenant?.id ?? ""} onChange={(event) => void switchTenant(event.target.value)}>
                      {tenantAccess!.memberships!.map((membership) => <option key={membership.id} value={membership.id}>{membership.name}</option>)}
                    </select>
                  </label>
                )}
                <div className={styles.profileSection}><UiModeSwitch compact /></div>
                <label className={styles.profileField}>
                  <span>Appearance</span>
                  <select className={ui.select} value={appearance.id} onChange={(event) => setAppearance(event.target.value)}>
                    {appearances.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
                <div className={styles.profileField}>
                  <span id="accent-label">Colour</span>
                  <div className={styles.swatches} role="radiogroup" aria-labelledby="accent-label">
                    {ACCENTS.map((option) => (
                      <button key={option.id} type="button" role="radio" aria-checked={accent === option.id} className={styles.swatch} onClick={() => setAccent(option.id)}>
                        <span className={styles.swatchDot} style={{ background: option.swatch }} aria-hidden="true" />
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>
                <label className={styles.profileField}>
                  <span>Language</span>
                  <select className={ui.select} value={locale} onChange={(event) => setLocale(event.target.value)}>
                    {supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.nativeName}{language.englishName && language.englishName !== language.nativeName ? ` · ${language.englishName}` : ""}</option>)}
                  </select>
                </label>
                <div className={ui.menuSeparator} role="separator" />
                {ADMIN_ROLES.has(role) && <button type="button" className={ui.menuItem} onClick={() => onTabChange("access_control")}><ShieldCheck aria-hidden="true" />Roles and access</button>}
                <button type="button" className={ui.menuItem} onClick={() => onTabChange("settings")}><Settings aria-hidden="true" />Settings</button>
                {tenantAccess?.platformAdmin && <Link href="/platform" className={ui.menuItem}><Settings aria-hidden="true" />Platform console</Link>}
                <div className={styles.shortcuts}><Keyboard size={14} aria-hidden="true" /><span><kbd>Ctrl K</kbd> search · <kbd>Alt M</kbd> all modules</span></div>
                <div className={ui.menuSeparator} role="separator" />
                <button type="button" className={ui.menuItem} onClick={logout}><LogOut aria-hidden="true" />Sign out</button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {customising && <CustomiseQuickActions open={customising} onClose={() => setCustomising(false)} quick={quick} />}
    </header>
  );
}
