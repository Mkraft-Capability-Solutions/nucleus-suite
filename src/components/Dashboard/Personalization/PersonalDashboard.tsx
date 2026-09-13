'use client';
import {useTranslation} from '@/context/I18nContext';


import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Tooltip } from '@mui/material';
import DragIndicator from '@mui/icons-material/DragIndicator';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import Undo from '@mui/icons-material/Undo';
import Redo from '@mui/icons-material/Redo';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import UploadOutlined from '@mui/icons-material/UploadOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import HubOutlined from '@mui/icons-material/HubOutlined';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import AccessTime from '@mui/icons-material/AccessTime';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import BoltOutlined from '@mui/icons-material/BoltOutlined';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import HelpOutline from '@mui/icons-material/HelpOutline';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { useAuth } from '@/context/AuthContext';
import { readData } from '@/services/workspace-data.mjs';
import { loadDashboardPreferences, saveDashboardPreferences } from '@/services/dashboard-preferences';
import { makeLayout, parseLayoutImport, permittedWidgets, sanitizeLayout, sanitizePreferences, type DashboardLayout, type DashboardPreferences, type WidgetDefinition, type WidgetInstance } from '@/lib/dashboard-layout';
import WidgetContent, { type WidgetRow } from './WidgetContent';
import styles from './PersonalDashboard.module.css';

const icons = { settings: SettingsOutlined, shield: ShieldOutlined, integrations: HubOutlined, people: PeopleOutline, clock: AccessTime, calendar: EventAvailableOutlined, school: SchoolOutlined, wallet: AccountBalanceWalletOutlined, bolt: BoltOutlined, award: EmojiEventsOutlined, help: HelpOutline, check: CheckCircleOutline };
type Catalog = { copy: { eyebrow: string; subtitle: string; localNotice: string; empty: string; libraryDescription: string; templateNames: Record<string, string>; roles: Record<string, string> }; widgets: WidgetDefinition[]; defaults: Record<string, string[]>; focused: Record<string, string[]>; datasets: Record<string, WidgetRow[]> };

function SortableWidget({ instance, definition, editing, index, count, columns, move, configure, remove, children }: { instance: WidgetInstance; definition: WidgetDefinition; editing: boolean; index: number; count: number; columns: number; move: (offset: number) => void; configure: () => void; remove: () => void; children: ReactNode }) {
    const {t: translateText}=useTranslation();

    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: instance.id, disabled: !editing });
    const Icon = icons[definition.icon as keyof typeof icons] || SettingsOutlined;
    return <section ref={setNodeRef} className={styles.widget} data-widget-id={instance.id} data-editing={editing} style={{ '--span': Math.min(instance.size, columns), transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? .65 : 1 } as CSSProperties} aria-label={instance.title}>
        <div className={styles.widgetHead}><div className={styles.widgetIcon}><Icon fontSize="small" /></div><div className={styles.widgetHeading}><h2>{instance.title}</h2><p>{definition.description}</p></div></div>
        {children}
        {editing && <div className={styles.widgetTools}>
            <Tooltip title={translateText("components.Dashboard.Personalization.PersonalDashboard","text_d07c7cc919")}><button className={`${styles.iconButton} ${styles.handle}`} ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_058c6c8a76", {value1: String(instance.title)})}><DragIndicator fontSize="small" /></button></Tooltip>
            <button className={styles.iconButton} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_8165809696", {value1: String(instance.title)})} onClick={() => move(-1)} disabled={index === 0}><ArrowUpward fontSize="small" /></button>
            <button className={styles.iconButton} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_189599ffae", {value1: String(instance.title)})} onClick={() => move(1)} disabled={index === count - 1}><ArrowDownward fontSize="small" /></button>
            <span className={styles.spacer} />
            <button className={styles.iconButton} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_b3cfc66057", {value1: String(instance.title)})} onClick={configure}><EditOutlined fontSize="small" /></button>
            <button className={styles.iconButton} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_0ab4d0cee3", {value1: String(instance.title)})} onClick={remove}><Close fontSize="small" /></button>
        </div>}
    </section>;
}

export default function PersonalDashboard({ consoleId, onNavigate, onShowConsole }: { consoleId: string; onNavigate: (target: string) => void; onShowConsole: () => void }) {
    const {t: translateText}=useTranslation();

    const { user, isModuleAllowed } = useAuth();
    const catalog = useMemo(() => readData('dashboard.widgets') as Catalog, []);
    const allowed = (module: string) => isModuleAllowed(module, user.role, user.id || user.email);
    const permittedIds = permittedWidgets(catalog.widgets, user.role, allowed).map(widget => widget.id).join(',');
    const definitions = useMemo(() => catalog.widgets.filter(widget => permittedIds.split(',').includes(widget.id)), [catalog, permittedIds]);
    const fallback = useMemo(() => makeLayout(definitions, catalog.defaults[user.role] || [], catalog.copy.templateNames[user.role] || 'My dashboard'), [definitions, catalog, user.role]);
    const identity = useMemo(() => ({ email: user.email, role: user.role, console: consoleId }), [user.email, user.role, consoleId]);
    const [preferences, setPreferences] = useState<DashboardPreferences | null>(null);
    const [draft, setDraft] = useState<DashboardLayout>(fallback);
    const [history, setHistory] = useState<DashboardLayout[]>([fallback]);
    const [cursor, setCursor] = useState(0);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [library, setLibrary] = useState(false);
    const [query, setQuery] = useState('');
    const [settings, setSettings] = useState<WidgetInstance | null>(null);
    const [newLayout, setNewLayout] = useState(false);
    const [deleteLayout, setDeleteLayout] = useState(false);
    const [newName, setNewName] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    useEffect(() => {
        let active = true;
        loadDashboardPreferences(identity, definitions, fallback).then(result => {
            if (!active) return;
            setPreferences(result.preferences);
            const next = result.preferences.layouts.find(layout => layout.id === result.preferences.activeId)!;
            setDraft(next); setHistory([next]); setCursor(0); setEditing(false);
            setError(result.warning || ''); setSettings(null); setLibrary(false);
        });
        return () => { active = false; };
    }, [identity, definitions, fallback]);
    useEffect(() => {
        if (!editing) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [editing]);

    function resetDraft(next: DashboardLayout) { setDraft(next); setHistory([next]); setCursor(0); setError(''); }
    function change(next: DashboardLayout) {
        const safe = { ...next, widgets: next.widgets.filter(widget => definitions.some(definition => definition.id === widget.id)) };
        const updated = [...history.slice(0, cursor + 1), safe].slice(-40);
        setHistory(updated); setCursor(updated.length - 1); setDraft(safe); setNotice('');
    }
    function move(id: string, offset: number) {
        const from = draft.widgets.findIndex(widget => widget.id === id);
        const to = Math.max(0, Math.min(draft.widgets.length - 1, from + offset));
        if (from < 0 || from === to) return;
        change({ ...draft, widgets: arrayMove(draft.widgets, from, to) });
        setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_30e69cdae3", {value1: String(draft.widgets[from].title), value2: String(to + 1)}));
    }
    function onDragEnd(event: DragEndEvent) {
        if (!editing || !event.over) return;
        const from = draft.widgets.findIndex(widget => widget.id === event.active.id);
        const to = draft.widgets.findIndex(widget => widget.id === event.over!.id);
        if (from >= 0 && to >= 0 && from !== to) move(String(event.active.id), to - from);
    }
    async function save() {
        if (!preferences || saving || !draft.name.trim()) return;
        if (preferences.layouts.some(layout => layout.id !== draft.id && layout.name.toLowerCase() === draft.name.trim().toLowerCase())) { setError(translateText("components.Dashboard.Personalization.PersonalDashboard","text_1f15ed0030")); return; }
        setSaving(true); setError('');
        const safe = sanitizeLayout(draft, definitions, fallback);
        const layouts = preferences.layouts.some(layout => layout.id === safe.id) ? preferences.layouts.map(layout => layout.id === safe.id ? safe : layout) : [...preferences.layouts, safe];
        const next = sanitizePreferences({ version: 1, activeId: safe.id, layouts }, definitions, fallback);
        try {
            await saveDashboardPreferences(identity, next);
            setPreferences(next); resetDraft(safe); setEditing(false); setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_711a3d028c"));
        } catch (error) { setError((error as Error).message); }
        finally { setSaving(false); }
    }
    async function selectLayout(id: string) {
        if (!preferences || editing) return;
        const selected = preferences.layouts.find(layout => layout.id === id);
        if (!selected) return;
        const next = { ...preferences, activeId: id };
        resetDraft(selected); setPreferences(next);
        try { await saveDashboardPreferences(identity, next); } catch (error) { setError((error as Error).message); }
    }
    async function removeLayout() {
        if (!preferences || preferences.layouts.length <= 1) return;
        const layouts = preferences.layouts.filter(layout => layout.id !== preferences.activeId);
        const next = { ...preferences, layouts, activeId: layouts[0].id };
        setSaving(true);
        try { await saveDashboardPreferences(identity, next); setPreferences(next); resetDraft(layouts[0]); setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_4b7577c6ff")); setDeleteLayout(false); }
        catch (error) { setError((error as Error).message); setDeleteLayout(false); }
        finally { setSaving(false); }
    }
    function exportLayout() {
        const safe = sanitizeLayout(draft, definitions, fallback);
        const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, layout: safe }, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nucleus-dashboard-layout.json'; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function importLayout(file?: File) {
        if (!file) return;
        try {
            if (file.size > 65536) throw new Error('Layout files must be smaller than 64 KB.');
            change(parseLayoutImport(await file.text(), definitions, draft));
            setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_3ed2181789"));
        } catch (error) { setError((error as Error).message); }
        if (fileInput.current) fileInput.current.value = '';
    }
    const visible = draft.widgets.filter(instance => definitions.some(definition => definition.id === instance.id));
    if (!preferences) return <p role="status">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_ac6f7ef8d2")}</p>;
    return <div className={styles.dashboard} data-personal-dashboard data-dashboard-editing={editing} data-admin-overview={user.role === 'SUPER_ADMIN' ? '' : undefined} data-accent={draft.accent} data-density={draft.density}>
        <header className={styles.header}><div><div className={styles.eyebrow}>{catalog.copy.eyebrow}</div><h1>{user.name}</h1><p>{catalog.copy.subtitle}</p></div><span className={styles.role}><ShieldOutlined sx={{ fontSize: 15 }} />{catalog.copy.roles[user.role]}</span></header>
        <div className={styles.toolbar} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_6e60195197")}>
            {!editing ? <><label>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_a511909161")}<select aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_a9d449165e")} value={preferences.activeId} onChange={event => selectLayout(event.target.value)}>{preferences.layouts.map(layout => <option key={layout.id} value={layout.id}>{layout.name}</option>)}</select></label><button className={styles.button} onClick={() => { setNewName(''); setNewLayout(true); }} disabled={preferences.layouts.length >= 6}><Add fontSize="small" />{translateText("components.Dashboard.Personalization.PersonalDashboard","text_ef02e11e38")}</button><button className={styles.button} disabled={preferences.layouts.length <= 1} onClick={() => setDeleteLayout(true)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_4cf7481104")}</button><span className={styles.spacer} /><button className={styles.button} onClick={onShowConsole}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_b4d1987a22")}<ArrowForward fontSize="small" /></button><button className={`${styles.button} ${styles.primary}`} onClick={() => { resetDraft(draft); setEditing(true); setNotice(''); }}><EditOutlined fontSize="small" />{translateText("components.Dashboard.Personalization.PersonalDashboard","text_c5276e27af")}</button></> : <>
                <label>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_dcd1d5223f")}<input aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_38a82ab9f4")} maxLength={50} value={draft.name} onChange={event => change({ ...draft, name: event.target.value })} /></label>
                <button className={styles.button} onClick={() => { setQuery(''); setLibrary(true); }}><Add fontSize="small" />{translateText("components.Dashboard.Personalization.PersonalDashboard","text_5ab344046c")}</button>
                <button className={styles.iconButton} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_6f8390f08f")} disabled={cursor === 0 || saving} onClick={() => { setCursor(cursor - 1); setDraft(history[cursor - 1]); }}><Undo fontSize="small" /></button>
                <button className={styles.iconButton} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_0d63542f78")} disabled={cursor === history.length - 1 || saving} onClick={() => { setCursor(cursor + 1); setDraft(history[cursor + 1]); }}><Redo fontSize="small" /></button>
                <span className={styles.spacer} />
                <button className={styles.button} disabled={saving} onClick={() => { resetDraft(preferences.layouts.find(layout => layout.id === preferences.activeId)!); setEditing(false); setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_0faebd62db")); }}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_19766ed6cc")}</button>
                <button className={`${styles.button} ${styles.primary}`} disabled={saving || !draft.name.trim()} onClick={save}><SaveOutlined fontSize="small" />{saving ?translateText("components.Dashboard.Personalization.PersonalDashboard","text_23e39291d6") :translateText("components.Dashboard.Personalization.PersonalDashboard","text_26ac39b198")}</button>
            </>}
        </div>
        {editing && <><div className={styles.toolbar} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_8920f4d176")}>
            <label>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_77a283d692")}<select aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_acf02edc11")} value={draft.density} onChange={event => change({ ...draft, density: event.target.value as DashboardLayout['density'] })}><option value="comfortable">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_459a23a598")}</option><option value="compact">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_99452646e3")}</option></select></label>
            <label>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_53aade77cd")}<select aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_c78f57b43e")} value={draft.columns} onChange={event => change({ ...draft, columns: Number(event.target.value) as 2 | 3 })}><option value={3}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_926f52d1c1")}</option><option value={2}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_94a72c074c")}</option></select></label>
            <label>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_a5c6fb18c9")}<select aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_b1416f188d")} value={draft.accent} onChange={event => change({ ...draft, accent: event.target.value as DashboardLayout['accent'] })}><option value="violet">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_2a36428839")}</option><option value="blue">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_ec7d56a016")}</option><option value="teal">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_fa15a5c1d6")}</option></select></label>
            <label>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_7252e7ce00")}<select aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_aeb59f9e9c")} value="" onChange={event => { if (event.target.value) change({ ...makeLayout(definitions, event.target.value === 'focused' ? catalog.focused[user.role] : event.target.value === 'blank' ? [] : catalog.defaults[user.role], draft.name, draft.id), accent: draft.accent }); }}><option value="" disabled>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_2f311e68c3")}</option><option value="default">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_8413878a5f")}</option><option value="focused">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_4f9a966fb2")}</option><option value="blank">{translateText("components.Dashboard.Personalization.PersonalDashboard","text_d719689dce")}</option></select></label>
            <button className={styles.button} onClick={() => fileInput.current?.click()}><UploadOutlined fontSize="small" />{translateText("components.Dashboard.Personalization.PersonalDashboard","text_2cff9baabf")}</button><button className={styles.button} onClick={exportLayout}><DownloadOutlined fontSize="small" />{translateText("components.Dashboard.Personalization.PersonalDashboard","text_3664895579")}</button>
            <input hidden ref={fileInput} aria-label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_709d0245c8")} type="file" accept="application/json,.json" onChange={event => importLayout(event.target.files?.[0])} />
        </div><p className={styles.editNote}><EditOutlined sx={{ fontSize: 15 }} />{translateText("components.Dashboard.Personalization.PersonalDashboard","text_7d7a09007e")}</p></>}
        {error && <p role="alert" className={styles.alert}>{error}</p>}
        <div role="status" aria-live="polite">{notice && <p className={styles.alert}>{notice}</p>}</div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible.map(widget => widget.id)} strategy={rectSortingStrategy}>
                <div className={styles.grid} style={{ '--columns': draft.columns } as CSSProperties} data-widget-grid>
                    {visible.map((instance, index) => {
                        const definition = definitions.find(widget => widget.id === instance.id)!;
                        return <SortableWidget key={instance.id} instance={instance} definition={definition} editing={editing} index={index} count={visible.length} columns={draft.columns} move={offset => move(instance.id, offset)} configure={() => setSettings({ ...instance })} remove={() => { change({ ...draft, widgets: draft.widgets.filter(widget => widget.id !== instance.id) }); setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_02613b813c", {value1: String(instance.title)})); }}>
                            <div className={styles.widgetBody}><WidgetContent definition={definition} instance={instance} rows={catalog.datasets[definition.dataKey] || []} allowed={allowed} onNavigate={onNavigate} editing={editing} /></div>
                            <div className={styles.widgetFooter}><span>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_10e65012f3")}</span>{definition.target && <button disabled={editing} onClick={() => allowed(definition.module) && onNavigate(definition.target!)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_b3e34b185d")}<ArrowForward sx={{ fontSize: 13 }} /></button>}</div>
                        </SortableWidget>;
                    })}
                </div>
            </SortableContext>
        </DndContext>
        {!visible.length && <div className={styles.empty}>{catalog.copy.empty}{!editing && <div><button className={styles.button} onClick={() => setEditing(true)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_c5276e27af")}</button></div>}</div>}
        <p className={styles.notice}>{catalog.copy.localNotice}</p>
        <Dialog className={styles.dialog} open={library} onClose={() => setLibrary(false)} fullWidth maxWidth="md"><DialogTitle>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_b4e58db359")}</DialogTitle><DialogContent><p>{catalog.copy.libraryDescription}</p><TextField autoFocus fullWidth label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_b82d286bbc")} value={query} onChange={event => setQuery(event.target.value)} /><div className={styles.library}>
            {definitions.filter(widget => `${widget.title} ${widget.description}`.toLowerCase().includes(query.toLowerCase())).map(widget => <article className={styles.libraryCard} key={widget.id}><h3>{widget.title}</h3><p>{widget.description}</p><Button disabled={draft.widgets.some(instance => instance.id === widget.id)} onClick={() => { change({ ...draft, widgets: [...draft.widgets, { id: widget.id, title: widget.title, size: widget.size, limit: 5 }] }); setNotice(translateText("components.Dashboard.Personalization.PersonalDashboard","text_139290a3b8", {value1: String(widget.title)})); }}>{draft.widgets.some(instance => instance.id === widget.id) ?translateText("components.Dashboard.Personalization.PersonalDashboard","text_6b02e0d363") :translateText("components.Dashboard.Personalization.PersonalDashboard","text_4706000596", {value1: String(widget.title)})}</Button></article>)}
        </div>{!definitions.some(widget => `${widget.title} ${widget.description}`.toLowerCase().includes(query.toLowerCase())) && <p>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_c289e9e0d2")}</p>}</DialogContent><DialogActions><Button onClick={() => setLibrary(false)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_11a6767d56")}</Button></DialogActions></Dialog>
        <Dialog className={styles.dialog} open={!!settings} onClose={() => setSettings(null)} fullWidth maxWidth="xs"><DialogTitle>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_359eba19f7")}</DialogTitle><DialogContent>{settings && <div className={styles.settings}>
            <TextField autoFocus label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_180fa5dbb1")} value={settings.title} onChange={event => setSettings({ ...settings, title: event.target.value })} slotProps={{ htmlInput: { maxLength: 64 } }} />
            <TextField select label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_de5c698b15")} value={settings.size} onChange={event => setSettings({ ...settings, size: Number(event.target.value) })}><MenuItem value={1}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_4af4c82aca")}</MenuItem><MenuItem value={2}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_ff4a0135d7")}</MenuItem><MenuItem value={3}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_d34008d28f")}</MenuItem></TextField>
            <TextField select label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_22b699fdff")} value={settings.limit} onChange={event => setSettings({ ...settings, limit: Number(event.target.value) })}><MenuItem value={3}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_0e5653cfa2")}</MenuItem><MenuItem value={5}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_4a065ef157")}</MenuItem><MenuItem value={8}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_84895542d8")}</MenuItem></TextField><p>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_fe8a865203")}</p>
        </div>}</DialogContent><DialogActions><Button onClick={() => setSettings(null)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_19766ed6cc")}</Button><Button disabled={!settings?.title.trim()} onClick={() => { if (settings) change({ ...draft, widgets: draft.widgets.map(widget => widget.id === settings.id ? settings : widget) }); setSettings(null); }}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_85045ccc05")}</Button></DialogActions></Dialog>
        <Dialog className={styles.dialog} open={deleteLayout} onClose={() => !saving && setDeleteLayout(false)}><DialogTitle>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_2b3ac95cbc")}</DialogTitle><DialogContent>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_5e98a0f680")}{draft.name}{translateText("components.Dashboard.Personalization.PersonalDashboard","text_e764f2493a")}</DialogContent><DialogActions><Button disabled={saving} onClick={() => setDeleteLayout(false)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_19766ed6cc")}</Button><Button disabled={saving} color="error" onClick={removeLayout}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_c823ef4e9e")}</Button></DialogActions></Dialog>
        <Dialog className={styles.dialog} open={newLayout} onClose={() => setNewLayout(false)} fullWidth maxWidth="xs"><DialogTitle>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_9227859394")}</DialogTitle><DialogContent><p>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_bd5423e688")}</p><TextField autoFocus fullWidth label={translateText("components.Dashboard.Personalization.PersonalDashboard","text_fce5b5ca0d")} value={newName} onChange={event => setNewName(event.target.value)} slotProps={{ htmlInput: { maxLength: 50 } }} /></DialogContent><DialogActions><Button onClick={() => setNewLayout(false)}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_19766ed6cc")}</Button><Button disabled={!newName.trim()} onClick={() => { resetDraft({ ...draft, id: crypto.randomUUID(), name: newName.trim() }); setEditing(true); setNewLayout(false); }}>{translateText("components.Dashboard.Personalization.PersonalDashboard","text_07d07af207")}</Button></DialogActions></Dialog>
    </div>;
}
