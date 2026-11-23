import requirements from "@/config/ui/process.requirements.json";

/**
 * Process-workbook reference for a screen (purpose, persona, form requirements, steps, rules).
 * This is product documentation shipped with the build, not tenant business data: it carries no records,
 * numbers or people. It is typed here so components stop going through readData(); the workbook remains the
 * single source until a docs/reference API exists.
 */
export type GuideRow = { row: number; cells: Record<string, string> };
export type ProcessScreenGuide = {
  screen: Record<string, string>;
  formFields: GuideRow[];
  steps: GuideRow[];
  rules: GuideRow[];
};

const screens = (requirements as unknown as { screens: Record<string, Partial<ProcessScreenGuide>> }).screens;

export function processGuideFor(screenId: string | null | undefined): ProcessScreenGuide | null {
  if (!screenId || !Object.hasOwn(screens, screenId)) return null;
  const guide = screens[screenId];
  if (!guide?.screen) return null;
  return { screen: guide.screen, formFields: guide.formFields ?? [], steps: guide.steps ?? [], rules: guide.rules ?? [] };
}
