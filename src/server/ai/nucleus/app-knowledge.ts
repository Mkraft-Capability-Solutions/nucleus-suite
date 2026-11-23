import "server-only";
import navigationCatalog from "@/config/ui/navigation.catalog.json";
import operationalRegistry from "@/config/ui/lib.operational-module-registry.json";

/**
 * What the assistant knows about the application itself: every screen it can open and every form on it.
 * Built from the same catalogs that drive the menus and the global search, so it cannot drift from the UI.
 */

export type AppScreen = {
  id: string;
  label: string;
  description: string;
  domain: string;
  domainLabel: string;
  group: string;
  tab: string;
};

export type AppForm = { id: string; title: string; screen: string; fields: string[] };

type RawItem = { id?: string; label?: string; desc?: string; targetTab?: string };
type RawDomain = { id?: string; label?: string; groups?: Array<{ heading?: string; items?: RawItem[] }> };
type RawModule = { id?: string; formId?: string; title?: string; fields?: Array<{ label?: string; key?: string }> };

const CODE_PREFIX = /^\s*S(?:10|[1-9])\s*[:\-–]\s*/;

export const APP_SCREENS: readonly AppScreen[] = ((navigationCatalog as { domains?: RawDomain[] }).domains ?? []).flatMap((domain) =>
  (domain.groups ?? []).flatMap((group) =>
    (group.items ?? [])
      .filter((item): item is Required<Pick<RawItem, "id" | "label">> & RawItem => Boolean(item.id && item.label))
      .map((item) => ({
        id: item.id,
        label: item.label.replace(CODE_PREFIX, ""),
        description: item.desc ?? "",
        domain: domain.id ?? "",
        domainLabel: domain.label ?? "",
        group: group.heading ?? "",
        tab: item.targetTab ?? item.id,
      })),
  ),
);

export const APP_FORMS: readonly AppForm[] = ((operationalRegistry as { modules?: RawModule[] }).modules ?? [])
  .filter((module) => module.id && module.title)
  .map((module) => ({
    id: module.formId ?? module.id ?? "",
    title: module.title ?? "",
    screen: module.id ?? "",
    fields: (module.fields ?? []).map((field) => field.label ?? field.key ?? "").filter(Boolean),
  }));

const screenIndex = new Map(APP_SCREENS.map((screen) => [screen.id, screen]));
const formScreenIndex = new Map(APP_FORMS.map((form) => [form.screen, form]));

/** Resolves a screen or form-backed module id to the navigation target the workspace understands. */
export function resolveScreen(id: string): { tab: string; domain?: string; sub: string; label: string } | null {
  const screen = screenIndex.get(id);
  if (screen) return { tab: screen.tab, domain: screen.domain || undefined, sub: screen.id, label: screen.label };
  const form = formScreenIndex.get(id);
  if (form) return { tab: form.screen, sub: form.screen, label: form.title };
  return null;
}

/** A compact map of the application for the system instruction: one line per screen, then one per form. */
export function describeApplication(): string {
  const screens = APP_SCREENS.map((s) => `- ${s.id}: ${s.label} (${s.domainLabel} › ${s.group})${s.description ? ` — ${s.description}` : ""}`);
  const forms = APP_FORMS.map((f) => `- ${f.screen}: ${f.title}${f.fields.length ? ` [fields: ${f.fields.slice(0, 12).join(", ")}${f.fields.length > 12 ? ", …" : ""}]` : ""}`);
  return ["SCREENS (open with open_screen using the id before the colon)", ...screens, "", "FORMS (open with open_screen using the id before the colon)", ...forms].join("\n");
}
