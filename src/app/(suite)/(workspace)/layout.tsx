import WorkspaceEntry from '@/components/WorkspaceEntry';
import { getPublicContent } from '@/services/public-content';
import { PublicSiteProvider } from '@/context/PublicSiteContext';
import { NucleusSessionProvider } from '@/context/NucleusSessionProvider';

export default async function WorkspaceLayout() {
    const {brand, login, nav} = await getPublicContent();
    return (
        <PublicSiteProvider content={{brand, login, nav}}>
            {/* NucleusSessionProvider is above the router: voice sessions survive navigation */}
            <NucleusSessionProvider>
                <WorkspaceEntry />
            </NucleusSessionProvider>
        </PublicSiteProvider>
    );
}
