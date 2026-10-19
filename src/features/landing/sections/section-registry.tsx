'use client';

/**
 * Code-split registry of the below-the-fold interactive sections (the flow board and sections 5–14). Each section's
 * module is imported only when its wrapper comes within 2 viewports (DeferredHydration + `preload`), so neither its
 * JavaScript evaluation nor its hydration sits on
 * the initial load's main thread. The server still renders every section's HTML (next/dynamic renders on the server).
 */
import type { ComponentType, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { DeferredHydration } from '../motion/deferred-hydration';
import { SectionErrorBoundary, type SectionFallbackCopy } from '../section-kit/section-error-boundary';

const loaders = {
  flow: () => import('./flow').then((module) => module.Flow),
  ba: () => import('./before-after-comparison-section').then((module) => module.BeforeAfterComparisonSection),
  platform: () => import('./platform-modules-section').then((module) => module.PlatformModulesSection),
  roles: () => import('./roles-section').then((module) => module.RolesSection),
  ai: () => import('./ai-copilot-section').then((module) => module.AiCopilotSection),
  volt: () => import('./nucleus-volt-voice-section').then((module) => module.NucleusVoltVoiceSection),
  roi: () => import('./time-saved-roi-section').then((module) => module.TimeSavedRoiSection),
  security: () => import('./security-isolation-section').then((module) => module.SecurityIsolationSection),
  implementation: () => import('./implementation-timeline-section').then((module) => module.ImplementationTimelineSection),
  faq: () => import('./faq-section').then((module) => module.FaqSection),
  demo: () => import('./demo-booking-section').then((module) => module.DemoBookingSection),
} as const satisfies Readonly<Record<string, () => Promise<ComponentType>>>;

export type DeferredSectionName = keyof typeof loaders;

/** One dynamic component per section (module scope, so React sees a stable component type). */
const SECTIONS: Readonly<Record<DeferredSectionName, ComponentType>> = {
  flow: dynamic(loaders.flow),
  ba: dynamic(loaders.ba),
  platform: dynamic(loaders.platform),
  roles: dynamic(loaders.roles),
  ai: dynamic(loaders.ai),
  volt: dynamic(loaders.volt),
  roi: dynamic(loaders.roi),
  security: dynamic(loaders.security),
  implementation: dynamic(loaders.implementation),
  faq: dynamic(loaders.faq),
  demo: dynamic(loaders.demo),
};

/** In-page anchor of each section (kept on the placeholder so header links and deep links resolve before loading). */
const ANCHORS: Readonly<Partial<Record<DeferredSectionName, string>>> = {
  flow: 'flow',
  ba: 'ba',
  platform: 'platform',
  roles: 'roles',
  ai: 'ai',
  volt: 'volt',
  roi: 'roi',
  security: 'security',
  implementation: 'implementation',
  faq: 'faq',
  demo: 'demo',
};

/** Heading and intro shown if a section fails to render (SectionErrorBoundary). */
const FALLBACK: Readonly<Record<DeferredSectionName, SectionFallbackCopy>> = {
  flow: { id: 'flow', title: 'flow.title', lead: 'flow.lead' },
  ba: { id: 'ba', title: 'ba.title' },
  platform: { id: 'platform', title: 'platform.title', lead: 'platform.lead' },
  roles: { id: 'roles', title: 'roles.title' },
  ai: { id: 'ai', title: 'ai.title', lead: 'ai.lead' },
  volt: { id: 'volt', title: 'volt.title', lead: 'volt.lead' },
  roi: { id: 'roi', title: 'roi.title' },
  security: { id: 'security', title: 'security.title', lead: 'security.lead' },
  implementation: { id: 'implementation', title: 'impl.title', lead: 'impl.lead' },
  faq: { id: 'faq', title: 'faq.title' },
  demo: { id: 'demo', title: 'demo.title', lead: 'demo.lead' },
};

export interface DeferredSectionProps {
  readonly name: DeferredSectionName;
  /**
   * Server-render the section's HTML (default: adopted without hydration until it comes within 2 viewports, so the
   * content is readable before any JavaScript and the page keeps its real height); `false` renders a placeholder.
   */
  readonly serverRender?: boolean;
}

export function DeferredSection({ name, serverRender = true }: DeferredSectionProps): ReactNode {
  const Section = SECTIONS[name];
  return (
    <DeferredHydration preload={loaders[name]} serverRender={serverRender} anchorId={ANCHORS[name]}>
      <SectionErrorBoundary name={name} copy={FALLBACK[name]}>
        <Section />
      </SectionErrorBoundary>
    </DeferredHydration>
  );
}
