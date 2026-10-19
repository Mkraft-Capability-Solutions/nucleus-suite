/**
 * Sections 5–14 of the landing page, in order: before/after (pinned) · platform modules (pinned) · roles · Nucleus AI
 * copilot (pinned) · Volt (pinned) · time saved · security · implementation timeline · FAQ · demo booking.
 * Server component: each section is a DeferredSection (section-registry.tsx): its HTML is server-rendered (content
 * readable before JavaScript, real height, anchors resolve) and its code loads and takes over only when it comes
 * within 2 viewports, keeping that JavaScript off the initial load (Total Blocking Time). A section that fails to
 * render falls back to its heading and intro (SectionErrorBoundary). Styles: styles/landing-sections.css.
 */
import type { ReactNode } from 'react';
import { DeferredSection } from './section-registry';
import '../styles/landing-sections.css';

export function LandingSections(): ReactNode {
  return (
    <div className="lp-sections">
      <DeferredSection name="ba" />
      <DeferredSection name="platform" />
      <DeferredSection name="roles" />
      <DeferredSection name="ai" />
      <DeferredSection name="volt" />
      <DeferredSection name="roi" />
      <DeferredSection name="security" />
      <DeferredSection name="implementation" />
      <DeferredSection name="faq" />
      <DeferredSection name="demo" />
    </div>
  );
}
