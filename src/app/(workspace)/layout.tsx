import WorkspaceEntry from '@/components/WorkspaceEntry';
import { getPublicContent } from '@/services/public-content';
import { PublicSiteProvider } from '@/context/PublicSiteContext';
export default async function WorkspaceLayout() {
    const {brand, login, nav} = await getPublicContent();
    return <PublicSiteProvider content={{brand, login, nav}}><WorkspaceEntry /></PublicSiteProvider>;
}
