import navigation from "@/config/ui/navigation.catalog.json";

type Item = { id: string; targetTab: string };
type Domain = { id: string; groups: Array<{ items: Item[] }> };

const INDEX = new Map<string, { domain: string; tab: string }>();
for (const domain of (navigation as { domains: Domain[] }).domains) {
  for (const group of domain.groups) {
    for (const item of group.items) INDEX.set(item.id, { domain: domain.id, tab: item.targetTab ?? item.id });
  }
}

/** Where a navigation item (navigation.catalog.json id) leads: its domain and workspace tab. */
export function navTarget(navId: string): { domain: string; tab: string; item: Item } | null {
  const entry = INDEX.get(navId);
  return entry ? { ...entry, item: { id: navId, targetTab: entry.tab } } : null;
}
