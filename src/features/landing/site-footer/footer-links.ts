/**
 * The MultipliersKraft footer's structure (from the site's new/content.js): link columns with their real absolute
 * URLs on multiplierskraft.com, social profiles and contact details. Labels come from the "nucleus" catalog
 * (footer.columns.<id>, footer.links.<id>).
 */
import type { SocialId } from './social-icons';

export const SITE = 'https://www.multiplierskraft.com';

export const FOOTER_COLUMNS = [
  { id: 'technology', links: [['palbon', '/palbon'], ['nucleus', '/nucleus'], ['magnetix', '/magnetix'], ['datanix', '/datanix']] },
  { id: 'consulting', links: [['leadership', '/corporate-consulting'], ['assessment', '/mkraft-assessment'], ['proctor', '/ai-proctor']] },
  { id: 'academics', links: [['mile', '/mile'], ['masterclass', '/nlp-masterclass-experience'], ['workshop', '/2-day-nlp-workshop'], ['blog', '/blog']] },
  { id: 'company', links: [['about', '/about#about'], ['team', '/about#leadership'], ['contact', '/contact'], ['request', '/raise-request'], ['signin', '/workspace']] },
] as const;

/** One footer link: catalog id (footer.links.<id>) and path on SITE. */
export type FooterLink = (typeof FOOTER_COLUMNS)[number]['links'][number];

export const SOCIAL: readonly { readonly id: SocialId; readonly label: string; readonly href: string }[] = [
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/company/multiplierskraft/' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/multiplierskraft/' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@MultipliersKraft' },
  { id: 'x', label: 'X', href: 'https://x.com' },
  { id: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/919611058522' },
];

export const CONTACT = {
  email: 'consult@multiplierskraft.com',
  phone: '+91-9611058522',
  tel: '+919611058522',
  linkedin: 'https://www.linkedin.com/company/multiplierskraft',
} as const;
