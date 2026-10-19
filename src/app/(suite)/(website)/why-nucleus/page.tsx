import PublicPage from '@/components/Website/PublicPage';
import { getPublicContent } from '@/services/public-content';
export async function generateMetadata() {
    const content = await getPublicContent();
    return { title: 'Why Nucleus | Nucleus', description: content.pages['why-nucleus'].description };
}
export default function Page() { return <PublicPage pageKey="why-nucleus" />; }
