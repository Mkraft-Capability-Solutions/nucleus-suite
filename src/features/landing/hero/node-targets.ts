/**
 * Where each hero orbit node leads. The page has no separate recruitment or onboarding sections yet: every module is
 * presented in the platform tour (#platform), so each node scrolls there and opens its own module tab (Hire →
 * recruitment and ATS, Onboard → onboarding, and so on). When dedicated sections land, change the `section` here.
 */
import type { ModuleId } from '../motion/module-selection';
import type { NodeSpec } from './hero-geometry';

export interface NodeTarget {
  /** Element id of the section to scroll to. */
  readonly section: 'platform';
  /** Platform tab to select on arrival. */
  readonly module: ModuleId;
}

export const NODE_TARGETS: Readonly<Record<NodeSpec['id'], NodeTarget>> = {
  hire: { section: 'platform', module: 'hire' },
  onboard: { section: 'platform', module: 'onboard' },
  manage: { section: 'platform', module: 'manage' },
  pay: { section: 'platform', module: 'pay' },
  perform: { section: 'platform', module: 'perform' },
  engage: { section: 'platform', module: 'engage' },
  support: { section: 'platform', module: 'support' },
  grow: { section: 'platform', module: 'grow' },
};
