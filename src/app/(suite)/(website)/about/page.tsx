import PublicPage from '@/components/Website/PublicPage';
import { getPublicContent } from '@/services/public-content';
export async function generateMetadata() {
    const content = await getPublicContent();
    return { title: 'About | Nucleus', description: content.pages['about'].description };
}
export default function Page() { return <PublicPage pageKey="about" />; }
