import 'server-only';
import content from '@/data/public-site.json';

export type PublicPageKey = keyof typeof content.pages;
/** Async repository boundary; intentionally separate from the demo-gated HR dataset. */
export async function getPublicContent() {
    return structuredClone(content);
}
