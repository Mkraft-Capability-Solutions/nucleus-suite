'use client';

import { Box, Button, Paper, Typography } from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import Hub from '@mui/icons-material/Hub';
import { useT } from '@/hooks/useT';
import { selectData, useApiResource } from '@/hooks/useApiResource';

/**
 * Admin landing (S10). Live status per card: tenant settings (GET /api/v1/tenant/settings) and integration
 * connections (GET /api/v1/integrations/connections). Loading and error states are explicit.
 */
const NS = 'components.Workspace.AdminOverview';
type Destination = 'settings' | 'access_control' | 'integrations';
type TenantSettings = { locale?: string; timezone?: string; currency?: string };
type Connection = { id: string; status?: string };

export default function AdminOverview({ user, onNavigate }: { user: { name: string }; onNavigate: (destination: Destination) => void }) {
    const { t } = useT();
    const { state: settings } = useApiResource<TenantSettings>('/api/v1/tenant/settings', selectData);
    const { state: connections } = useApiResource<Connection[]>('/api/v1/integrations/connections', (p) => {
        const d = selectData<unknown>(p);
        return Array.isArray(d) ? (d as Connection[]) : [];
    });
    const status = (s: { status: string; message?: string }, ready: () => string) => s.status === 'ready' ? ready() : s.status === 'error' ? (s.message || t(`${NS}.text_unavailable`, 'Status unavailable')) : t(`${NS}.text_loading`, 'Loading…');
    const settingsData = settings.status === 'ready' ? settings.data : null;
    const cards: Array<{ target: Destination; icon: typeof Settings; title: string; description: string; action: string; live: string }> = [
        { target: 'settings', icon: Settings, title: t(`${NS}.text_settings_title`, 'Workspace settings'), description: t(`${NS}.text_settings_desc`, 'Organization preferences and account settings.'), action: t(`${NS}.text_settings_action`, 'Open settings'),
          live: status(settings, () => t(`${NS}.text_settings_live`, 'Locale {locale} · time zone {timezone} · currency {currency}', { locale: settingsData?.locale ?? '—', timezone: settingsData?.timezone ?? '—', currency: settingsData?.currency ?? '—' })) },
        { target: 'access_control', icon: AdminPanelSettings, title: t(`${NS}.text_access_title`, 'Roles & access'), description: t(`${NS}.text_access_desc`, 'Module permissions and console visibility for each role, enforced on the server.'), action: t(`${NS}.text_access_action`, 'Review access'), live: '' },
        { target: 'integrations', icon: Hub, title: t(`${NS}.text_integrations_title`, 'Integrations'), description: t(`${NS}.text_integrations_desc`, 'Connector configuration, status and sync.'), action: t(`${NS}.text_integrations_action`, 'Open integrations'),
          live: status(connections, () => t(`${NS}.text_integrations_live`, '{count} connections configured', { count: connections.status === 'ready' ? connections.data.length : 0 })) },
    ];
    return (
        <Box data-admin-overview sx={{ width: '100%', minWidth: 0, p: { xs: 1, md: 3 } }}>
            <Typography variant="overline">{t(`${NS}.text_eyebrow`, 'Workspace governance')}</Typography>
            <Typography variant="h4" component="h1">{user.name}</Typography>
            <Typography sx={{ my: 2 }}>{t(`${NS}.text_description`, 'Manage workspace configuration, role access and integrations from one place.')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                {cards.map(({ target, icon: Icon, title, description, action, live }) => (
                    <Paper key={target} variant="outlined" sx={{ p: 3 }}>
                        <Icon color="primary" aria-hidden="true" />
                        <Typography variant="h6" component="h2" sx={{ mt: 1 }}>{title}</Typography>
                        <Typography sx={{ my: 2 }}>{description}</Typography>
                        {live && <Typography variant="body2" role="status" sx={{ mb: 2 }}>{live}</Typography>}
                        <Button onClick={() => onNavigate(target)}>{action}</Button>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
}
