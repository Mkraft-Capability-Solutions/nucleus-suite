import PublicPage from '@/components/Website/PublicPage';
import { getPublicContent } from '@/services/public-content';
export async function generateMetadata() {
    const content = await getPublicContent();
    return { title: 'Contact us | Nucleus', description: content.pages['contact'].description };
}
export default function Page() { return <PublicPage pageKey="contact" />; }
