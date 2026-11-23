import {t as translateText} from '@/lib/i18n';
import ArrowForward from '@mui/icons-material/ArrowForward';
import type { WidgetDefinition, WidgetInstance, AccessCheck } from '@/lib/dashboard-layout';
import styles from './PersonalDashboard.module.css';
export type WidgetRow = { label: string; detail?: string; status?: string; value?: number; total?: number; unit?: string; target?: string; module?: string };
export default function WidgetContent({ definition, instance, rows, allowed, onNavigate, editing }: { definition: WidgetDefinition; instance: WidgetInstance; rows: WidgetRow[]; allowed: AccessCheck; onNavigate: (target: string) => void; editing: boolean }) {
    // Only navigation links are static; data widgets have no wired API yet, so no sample values are shown.
    const isKind = (kind: string) => definition.kind === kind;
    if (!isKind('links')) return <p className={styles.notice} role="note">{translateText("components.Dashboard.Personalization.WidgetContent.text_data_unavailable", "Live data for this card is not connected yet. Open the module for current figures.")}</p>;
    const visible = rows.filter(row => !row.module || allowed(row.module)).slice(0, instance.limit);
    if (!visible.length) return <p className={styles.notice}>{translateText("components.Dashboard.Personalization.WidgetContent","text_74585fab8d")}</p>;
    if (isKind('metrics')) return <div className={styles.metricGrid}>{visible.map(row => <div className={styles.metric} key={row.label}><strong>{row.value}</strong><span>{row.unit}</span><p>{row.label}</p></div>)}</div>;
    if (isKind('bars')) return <div>{visible.map(row => <div key={row.label} className={styles.progressRow}><div className={styles.progressLabel}><strong>{row.label}</strong><span>{row.value}{row.unit === '%' ? '%' :translateText("components.Dashboard.Personalization.WidgetContent","text_ae06037ad4", {value1: String(row.total), value2: String(row.unit)})}</span></div><div className={styles.bar} role="progressbar" aria-label={row.label} aria-valuenow={row.value} aria-valuemin={0} aria-valuemax={row.total}><span style={{ width: `${Math.min(100, Math.max(0, (row.value || 0) / (row.total || 1) * 100))}%` }} /></div></div>)}</div>;
    return <div className={styles.rows}>{visible.map(row => definition.kind === 'links' ? <button disabled={editing} className={`${styles.row} ${styles.linkRow}`} key={row.label} onClick={() => row.target && (!row.module || allowed(row.module)) && onNavigate(row.target)}><div><strong>{row.label}</strong><p>{row.detail}</p></div><ArrowForward sx={{ fontSize: 17 }} /></button> : <div className={styles.row} key={row.label}><div><strong>{row.label}</strong><p>{row.detail}</p></div>{row.status && <span className={styles.status}>{row.status}</span>}</div>)}</div>;
}
