import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("navigation shell", () => {
  const shell = readFileSync(resolve(process.cwd(), "src/components/hrms/app-shell.tsx"), "utf8");
  const launcher = readFileSync(resolve(process.cwd(), "src/components/hrms/module-launcher.tsx"), "utf8");
  const rightRail = readFileSync(resolve(process.cwd(), "src/components/hrms/integrated-right-rail.tsx"), "utf8");
  const rootLayout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
  const themeProvider = readFileSync(resolve(process.cwd(), "src/components/theme-provider.tsx"), "utf8");

  it("uses authorized business domains and keyboard-accessible collapsed navigation", () => {
    expect(shell).toContain("navigationDomains.flatMap");
    expect(shell).toContain("authorized.find(item => item.domain === domain.id)");
    // The dock now renders domains for an administrator and self-service groups
    // for everybody else, so one shared link builder takes a plain `label`
    // instead of a domain. The accessible name the collapsed 64px rail depends
    // on is still there — it is spelled `label`, not `domain.label`.
    expect(shell).toContain('aria-label={label}');
    // Keyboard focus must still expand the collapsed dock. It is keyed on
    // `:focus-visible` rather than plain `:focus-within`, which also matched the
    // focus a mouse click leaves behind and held the dock open over the page long
    // after the pointer had gone. The guarantee is unchanged: a keyboard user can
    // reach and read the labels.
    expect(shell).toContain('has-[:focus-visible]:w-[240px]');
    expect(shell).not.toContain('focus-within:w-[240px]');
    expect(shell).not.toContain('...getAuthorizedNavigation(permissions).map');
  });

  it("splits the dock by principal and offers no way to cross the split", () => {
    // One rule for who is administrative, imported rather than re-implemented.
    expect(shell).toContain('import { isAdminPrincipal } from "@/lib/cockpit-catalog"');
    expect(shell).toContain("buildEmployeeNavigationGroups");
    expect(shell).toContain("? domains.map(");
    expect(shell).toContain(": groups.map(");
    // No nav-mode switcher: an employee must not be able to put themselves on
    // the administrative navigation.
    expect(shell).not.toContain("Switch to Admin");
    expect(shell).not.toContain("setNavMode");
    expect(rightRail).not.toContain("Switch to Admin");
  });

  it("gives a non-administrative reader a self-service right rail", () => {
    expect(rightRail).toContain("My dashboard views");
    expect(rightRail).toContain("My Consoles & Hub");
    // Read from the cockpit registry, never hardcoded to S8.
    expect(rightRail).toContain("authorizedCockpits(permissions, roles)");
    expect(rightRail).not.toContain('"employee-home"');
  });

  it("reserves space for the reference-sized rails and retains a mobile sheet", () => {
    expect(shell).toContain('pl-[64px]');
    expect(shell).toContain('w-[260px]');
    expect(shell).toContain('xl:block');
    expect(shell).toContain('<Sheet open={mobileDrawerOpen}');
    expect(shell).toContain('sm:max-w-[320px]');
    expect(rightRail).toContain('selectedDomain ?? activeItem?.domain');
    expect(rightRail).toContain('overflow-y-auto overscroll-contain');
  });

  it("uses a responsive centered desktop launcher without blue overlay", () => {
    expect(launcher).toContain("Dialog.Backdrop");
    expect(launcher).toContain("Dialog.Popup");
    expect(launcher).not.toContain("bg-slate-950");
  });

  it("provides contextual routes and work tools in the right rail", () => {
    expect(rightRail).toContain("item.group");
    expect(rightRail).not.toContain("workflowSections(");
    expect(rightRail).toContain("contextualItems");
    expect(rightRail).toContain("My day");
    expect(rightRail).toContain("Ask Nucleus AI");
    expect(rightRail).not.toContain("Open governed assistant");
    expect(rightRail).toContain('className="shrink-0 border-t border-border p-3"');
  });

  it("keeps a labelled theme switch in the compact title bar", () => {
    expect(shell).toContain("function ThemeToggle()");
    expect(shell).toContain("toggleTheme");
    expect(shell).toContain("Switch to");
    expect(rootLayout).toContain("className={`dark h-full antialiased");
    expect(themeProvider).toContain('useState<Theme>("dark")');
  });

  it("provides real feature navigation beside account controls", () => {
    expect(shell).toContain("<ThemeToggle />");
    expect(shell).toContain("<PersonaSwitcher />");
    expect(shell).not.toContain("<WorkspaceFeatureSelector />");
    expect(shell).not.toContain("setActiveConsole");
  });

  it("supports the documented launcher keyboard shortcut and mobile flow", () => {
    expect(launcher).toContain('event.key.toLowerCase() === "m"');
    expect(launcher).toContain('"domains" | "destinations"');
    expect(launcher).toContain("getAuthorizedNavigation(permissions, roles)");
  });
});
