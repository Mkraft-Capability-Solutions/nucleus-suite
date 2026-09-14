'use client';
import { createContext, type ReactNode } from 'react';
export type PublicNavigation = { brand: string; tagline?: string; login: string; nav: {href: string; label: string}[] };
export const PublicSiteContext = createContext<PublicNavigation | null>(null);
export function PublicSiteProvider({content, children}: {content: PublicNavigation; children: ReactNode}) {
    return <PublicSiteContext.Provider value={content}>{children}</PublicSiteContext.Provider>;
}
