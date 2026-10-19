import PublicPage from '@/components/Website/PublicPage';
import { getPublicContent } from '@/services/public-content';
export async function generateMetadata() {
    const content = await getPublicContent();
    return { title: 'Docs | Nucleus', description: content.pages['docs'].description };
}
export default function Page() { return <PublicPage pageKey="docs" />; }
