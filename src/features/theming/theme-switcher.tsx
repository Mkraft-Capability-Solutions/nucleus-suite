'use client';

/**
 * Appearance picker: an icon button (in a header, or floating) that opens a panel with the approved theme swatches and
 * light / dark / system.
 *
 * Accessibility: the panel is a native popover (top layer, Escape and outside click close it, focus returns to the
 * button) labelled as a dialog; each choice is a native radio group inside a fieldset with a legend, so arrow keys
 * move between options and screen readers announce "Theme, Emerald, 4 of 7, selected". All text comes from the
 * theming catalog.
 */
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Moon, Palette, Sun, type LucideIcon } from 'lucide-react';
import { APPROVED_THEME_IDS, MODE_PREFERENCES, THEMES, type ModePreference, type ThemeId } from '@nucleus/design-tokens';
import themingCatalog from '@/i18n/catalogs/theming';
import type { MessageKey } from '@/i18n/catalog';
import type { ThemingMessages } from '@/i18n/catalogs/theming/en';
import { useTranslations } from '@/i18n/use-translations';
import { useTheme } from './use-theme';
import styles from './theme-switcher.module.css';

type ThemingKey = MessageKey<ThemingMessages>;

/** Translation key of every theme's display name. */
export const THEME_NAME_KEYS: Readonly<Record<ThemeId, ThemingKey>> = {
  horizon: 'themes.horizon',
  signature: 'themes.signature',
  'sapphire-tide': 'themes.sapphireTide',
  'emerald-grove': 'themes.emeraldGrove',
  'saffron-ember': 'themes.saffronEmber',
  'rose-quartz': 'themes.roseQuartz',
  platinum: 'themes.platinum',
};

/** Approved themes, in switcher order (Horizon first). */
const PICKABLE_THEMES = APPROVED_THEME_IDS.flatMap((id) => THEMES.filter((theme) => theme.id === id));

const MODE_OPTIONS: Readonly<Record<ModePreference, { readonly key: ThemingKey; readonly Icon: LucideIcon }>> = {
  light: { key: 'modes.light', Icon: Sun },
  dark: { key: 'modes.dark', Icon: Moon },
  system: { key: 'modes.system', Icon: Monitor },
};

function subscribeNothing(): () => void {
  return () => undefined;
}

function isClient(): boolean {
  return true;
}

function isServer(): boolean {
  return false;
}

/** Gap between the trigger and the panel, in px (matches --space-2). */
const PANEL_OFFSET_PX = 8;

export type ThemeSwitcherPlacement = 'header' | 'floating';

export interface ThemeSwitcherProps {
  /** `header`: an icon button in a top bar, panel opens below it. `floating`: a fixed button at the bottom inline end. */
  readonly placement?: ThemeSwitcherPlacement;
  /** Offer the theme swatches (tenant admin settings, marketing preview). Viewers elsewhere only choose the mode. */
  readonly showThemes?: boolean;
}

export function ThemeSwitcher({ placement = 'header', showThemes = true }: ThemeSwitcherProps): ReactNode {
  const t = useTranslations(themingCatalog);
  const { themeId, mode, setThemeId, setMode } = useTheme();
  const panelId = useId();
  const titleId = useId();
  const themeName = useId();
  const modeName = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The panel is portalled to <body> (top layer, free of host-page styles), which needs the client document.
  const mounted = useSyncExternalStore(subscribeNothing, isClient, isServer);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const onBeforeToggle = (event: Event): void => {
      const trigger = triggerRef.current;
      if (!(event instanceof ToggleEvent) || event.newState !== 'open' || !trigger || placement !== 'header') return;
      const rect = trigger.getBoundingClientRect();
      const rtl = getComputedStyle(trigger).direction === 'rtl';
      panel.style.setProperty('--panel-block-start', `${Math.round(rect.bottom + PANEL_OFFSET_PX)}px`);
      panel.style.setProperty('--panel-inline-end', `${Math.round(rtl ? rect.left : window.innerWidth - rect.right)}px`);
    };
    const onToggle = (event: Event): void => {
      if (!(event instanceof ToggleEvent) || event.newState !== 'open') return;
      panel.querySelector<HTMLInputElement>('input:checked')?.focus();
    };
    panel.addEventListener('beforetoggle', onBeforeToggle);
    panel.addEventListener('toggle', onToggle);
    return () => {
      panel.removeEventListener('beforetoggle', onBeforeToggle);
      panel.removeEventListener('toggle', onToggle);
    };
  }, [mounted, placement]);

  const panel = (
    <div ref={panelRef} id={panelId} popover="auto" role="dialog" aria-labelledby={titleId} className={placement === 'header' ? styles.panelHeader : styles.panelFloating}>
      <h2 id={titleId} className={styles.title}>
        {t('switcher.title')}
      </h2>

      {showThemes ? (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('switcher.themeLegend')}</legend>
          <div className={styles.swatches}>
            {PICKABLE_THEMES.map((theme) => (
              <label key={theme.id} className={styles.swatchOption}>
                <input
                  type="radio"
                  name={themeName}
                  value={theme.id}
                  checked={theme.id === themeId}
                  onChange={() => setThemeId(theme.id)}
                  className={styles.radio}
                />
                <span aria-hidden="true" className={styles.swatch} data-theme-id={theme.id} />
                <span className={styles.swatchLabel}>{t(THEME_NAME_KEYS[theme.id])}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('switcher.modeLegend')}</legend>
        <div className={styles.modes}>
          {MODE_PREFERENCES.map((option) => {
            const { key, Icon } = MODE_OPTIONS[option];
            return (
              <label key={option} className={styles.modeOption}>
                <input
                  type="radio"
                  name={modeName}
                  value={option}
                  checked={option === mode}
                  onChange={() => setMode(option)}
                  className={styles.radio}
                />
                <Icon aria-hidden="true" className={styles.modeIcon} />
                <span>{t(key)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );

  return (
    <span className={styles.switcher}>
      <button
        ref={triggerRef}
        type="button"
        className={placement === 'header' ? styles.triggerHeader : styles.triggerFloating}
        popoverTarget={panelId}
        aria-label={t('switcher.triggerLabel')}
      >
        <Palette aria-hidden="true" className={styles.triggerIcon} />
      </button>
      {mounted ? createPortal(panel, document.body) : null}
    </span>
  );
}
