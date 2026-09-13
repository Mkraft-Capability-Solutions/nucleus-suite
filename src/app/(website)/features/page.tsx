import PublicPage from '@/components/Website/PublicPage';
import { getPublicContent } from '@/services/public-content';
export async function generateMetadata() {
    const content = await getPublicContent();
    return { title: 'Features | Nucleus', description: content.pages['features'].description };
}
export default function Page() { return <PublicPage pageKey="features" />; }
