'use client';

import { Box, Button, Paper, Typography } from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import Hub from '@mui/icons-material/Hub';
import { readData } from '@/services/workspace-data.mjs';

const icons = { settings: Settings, access_control: AdminPanelSettings, integrations: Hub };

type Destination = keyof typeof icons;
type Content = {
    eyebrow: string;
    description: string;
    notice: string;
    cards: { target: Destination; title: string; description: string; action: string }[];
};

export default function AdminOverview({ user, onNavigate }: {
    user: { name: string };
    onNavigate: (destination: Destination) => void;
}) {
    const content = readData('components.Clerio.AdminOverview', 'content') as Content;
    return (
        <Box data-admin-overview sx={{ width: '100%', minWidth: 0, p: { xs: 1, md: 3 } }}>
            <Typography variant="overline">{content.eyebrow}</Typography>
            <Typography variant="h4" component="h1">{user.name}</Typography>
            <Typography sx={{ my: 2 }}>{content.description}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                {content.cards.map(card => {
                    const Icon = icons[card.target];
                    return <Paper key={card.target} variant="outlined" sx={{ p: 3 }}>
                        <Icon color="primary" />
                        <Typography variant="h6" component="h2" sx={{ mt: 1 }}>{card.title}</Typography>
                        <Typography sx={{ my: 2 }}>{card.description}</Typography>
                        <Button onClick={() => onNavigate(card.target)}>{card.action}</Button>
                    </Paper>;
                })}
            </Box>
            <Typography role="note" sx={{ mt: 3 }}>{content.notice}</Typography>
        </Box>
    );
}
