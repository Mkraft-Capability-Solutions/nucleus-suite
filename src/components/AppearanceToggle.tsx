'use client';
import {useTranslation} from '@/context/I18nContext';

import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Check from '@mui/icons-material/Check';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import { appearances } from '@/lib/appearance';
import { useAppearance } from '@/context/AppearanceContext';
import styles from './AppearanceToggle.module.css';
export default function AppearanceToggle() {
    const {t: translateText}=useTranslation();

    const { appearance, setAppearance } = useAppearance();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    return <>
        <button type="button" className={styles.trigger} aria-label={translateText("components.AppearanceToggle","text_d6effeab12")} title={translateText("components.AppearanceToggle","text_c40f363118", {value1: String(appearance.name)})} aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={event => setAnchor(event.currentTarget)}><PaletteOutlined fontSize="small" /></button>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ list: { 'aria-label': 'Application theme' }, paper: { sx: { width: 300, maxWidth: 'calc(100vw - 24px)' } } }}>
            {appearances.map(theme => <MenuItem key={theme.id} role="menuitemradio" aria-checked={appearance.id === theme.id} aria-label={theme.name} onClick={() => { setAppearance(theme.id); setAnchor(null); }} sx={{ whiteSpace: 'normal', gap: 1.5, py: 1.5 }}>
                <span className={styles.swatch} style={{ background: theme.tokens['--card'], borderColor: theme.tokens['--signal'] }} aria-hidden="true"><span style={{ background: theme.tokens['--signal'] }} /><span style={{ background: theme.tokens['--agent'] }} /></span>
                <span className={styles.copy}><strong>{theme.name}</strong><small>{theme.description}</small></span>
                {appearance.id === theme.id && <Check sx={{ fontSize: 18, flexShrink: 0 }} />}
            </MenuItem>)}
        </Menu>
    </>;
}
