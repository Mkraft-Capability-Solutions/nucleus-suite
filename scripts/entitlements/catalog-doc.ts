/**
 * Prints the module catalog as Markdown (used for MULTI_TENANCY.md, section "Catalog").
 *   npx tsx scripts/entitlements/catalog-doc.ts
 */
import { MODULE_CATALOG } from "../../src/lib/entitlements/catalog";

const lines: string[] = [];
const yes = (value: boolean) => (value ? "on" : "off");
for (const mod of MODULE_CATALOG) {
  lines.push(`### ${mod.name} \`${mod.key}\` — ${mod.tier}${mod.requires?.length ? ` (requires ${mod.requires.map((key) => `\`${key}\``).join(", ")})` : ""}`);
  lines.push("");
  lines.push(mod.description);
  lines.push("");
  lines.push("| Key | Name | Default | Requires | Settings |");
  lines.push("|---|---|---|---|---|");
  for (const sub of mod.submodules) {
    const settings = (sub.config ?? []).map((field) => `\`${field.key}\``).join(", ");
    lines.push(`| \`${mod.key}.${sub.key}\` | ${sub.name}${sub.locked ? " (always on)" : ""} | ${yes(sub.defaultEnabled)} | ${(sub.requires ?? []).map((key) => `\`${key}\``).join(", ")} | ${settings} |`);
    for (const feature of sub.features ?? []) {
      lines.push(`| \`${mod.key}.${sub.key}.${feature.key}\` | ↳ ${feature.name} (feature) | ${yes(feature.defaultEnabled)} | ${(feature.requires ?? []).map((key) => `\`${key}\``).join(", ")} | |`);
    }
  }
  lines.push("");
}
console.log(lines.join("\n"));
