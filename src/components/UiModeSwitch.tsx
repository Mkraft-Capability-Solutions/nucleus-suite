"use client";

import { useId } from "react";
import { useUiMode } from "@/context/UiModeContext";
import { UI_MODE_LABELS, UI_MODES } from "@/lib/ui-mode";
import styles from "./UiModeSwitch.module.css";

/**
 * Classic / Redesigned switch. A radio group, so it works with the keyboard and screen readers
 * wherever it is placed (user menu, theme menu). Switching never reloads the page.
 */
export default function UiModeSwitch({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useUiMode();
  const id = useId();
  return (
    <fieldset className={styles.switch} aria-describedby={compact ? undefined : `${id}-hint`}>
      <legend className={styles.legend}>Interface</legend>
      <div className={styles.options}>
        {UI_MODES.map((option) => (
          <label key={option} className={styles.option} data-checked={mode === option}>
            <input
              type="radio"
              name={`${id}-mode`}
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              onClick={(event) => event.stopPropagation()}
            />
            {UI_MODE_LABELS[option].name}
          </label>
        ))}
      </div>
      {!compact && <p id={`${id}-hint`} className={styles.hint}>{UI_MODE_LABELS[mode].description}</p>}
    </fieldset>
  );
}
