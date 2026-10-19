/**
 * Organisations shown in the landing page's trust marquee. Logos live in public/partners/ (named after the company).
 * `width` × `height` is the logo's intrinsic aspect (explicit dimensions, no layout shift). `ink` says whether the
 * mark is dark ink on a light/transparent ground (`dark`) or light ink (`light`), so the marquee can render every logo
 * as a single neutral tone in both colour modes (see partner-marquee.css).
 */
export interface Partner {
  readonly id: string;
  readonly name: string;
  readonly logo: string;
  readonly width: number;
  readonly height: number;
  readonly ink: 'dark' | 'light';
  /** Rendered height (px), tuned per mark so every logo carries the same optical weight in the row. */
  readonly displayHeight: number;
}

export const PARTNERS: readonly Partner[] = [
  { id: 'bosch', name: 'Bosch', logo: '/partners/bosch.svg', width: 433, height: 97, ink: 'dark', displayHeight: 20 },
  { id: 'dr-reddys', name: "Dr. Reddy's", logo: '/partners/dr-reddys.svg', width: 4535, height: 1006, ink: 'dark', displayHeight: 22 },
  { id: 'merck', name: 'Merck', logo: '/partners/merck.svg', width: 1038, height: 310, ink: 'dark', displayHeight: 22 },
  { id: 'hindustan-petroleum', name: 'Hindustan Petroleum', logo: '/partners/hindustan-petroleum.webp', width: 126, height: 160, ink: 'dark', displayHeight: 30 },
  { id: 'panasonic', name: 'Panasonic', logo: '/partners/panasonic.svg', width: 189, height: 31, ink: 'dark', displayHeight: 15 },
  { id: 'narayana-health', name: 'Narayana Health', logo: '/partners/narayana-health.svg', width: 1518, height: 602, ink: 'dark', displayHeight: 28 },
  { id: 'endurance', name: 'Endurance', logo: '/partners/endurance.webp', width: 774, height: 160, ink: 'dark', displayHeight: 26 },
  { id: 'cotiviti', name: 'Cotiviti', logo: '/partners/cotiviti.svg', width: 566, height: 69, ink: 'dark', displayHeight: 15 },
  { id: 'neolync', name: 'Neolync', logo: '/partners/neolync.svg', width: 1041, height: 276, ink: 'light', displayHeight: 22 },
];
