import { picklists, type PicklistCode } from "@/lib/picklists";
import type { Translate } from "./api";

/**
 * Options for a system picklist (the typed workbook vocabulary in `src/lib/picklists.ts`,
 * the same set the server schemas validate against), with labels through i18n.
 */
const NS = "components.Workspace.Picklists";

export type Option = { value: string; label: string };

export function picklistOptions(code: PicklistCode, t: Translate): Option[] {
  return picklists[code].values.map((entry) => ({ value: entry.value, label: t(`${NS}.${code}_${entry.value}`, entry.label) }));
}

export function picklistText(code: PicklistCode, value: string | null | undefined, t: Translate): string {
  if (!value) return "";
  const entry = picklists[code].values.find((item) => item.value === value || item.label.toLowerCase() === value.toLowerCase());
  return entry ? t(`${NS}.${code}_${entry.value}`, entry.label) : value;
}
