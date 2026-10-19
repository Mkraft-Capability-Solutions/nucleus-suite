/**
 * scrollToPlatformModule(id): scroll the page to the platform tour (#platform) at the scroll step that shows module
 * `id`. The tour is pinned and its scroll position IS the selected tab, so landing on the step selects the module.
 * Safe to call before the tour has loaded (it renders a one-viewport placeholder until then): the target is
 * re-resolved every frame, so it follows the section as it loads and grows. When the tour is un-pinned (narrow or
 * short viewports) it scrolls to the section top and the tour opens the module through the shared module selection.
 *
 * Tiny on purpose (no React, no section code), so the hero can import it without pulling in the tour.
 */
import { MODULE_IDS, selectModule, type ModuleId } from '../motion/module-selection';
import { scrollToTarget } from '../motion/scroll-engine';

export const PLATFORM_SECTION_ID = 'platform';

function headerOffset(): number {
  return document.querySelector('.lp-header')?.getBoundingClientRect().height ?? 0;
}

/** Document Y that shows module `index` in the platform tour (pinned: the middle of its scroll step). */
export function platformModuleY(index: number): number {
  const section = document.getElementById(PLATFORM_SECTION_ID);
  if (!section) return window.scrollY;
  const top = section.getBoundingClientRect().top + window.scrollY;
  const stage = section.querySelector<HTMLElement>('[data-pin-stage]');
  if (!stage || getComputedStyle(stage).position !== 'sticky') return top - headerOffset();
  const run = Math.max(0, section.offsetHeight - window.innerHeight);
  return top + ((index + 0.5) / MODULE_IDS.length) * run;
}

export function scrollToPlatformModule(id: ModuleId): void {
  selectModule(id);
  const index = MODULE_IDS.indexOf(id);
  scrollToTarget(() => platformModuleY(index));
}
