'use client';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { readData } from '@/services/workspace-data.mjs';
import styles from './ProcessGuide.module.css';

export default function ProcessGuide({ screenId }) {
    const guide = readData('process.requirements', 'screens')[screenId];
    const copy = readData('process.requirements', 'copy');
    if (!guide) return null;
    return <details className={styles.guide}>
        <summary><MenuBookOutlined fontSize="small" />{copy.title} · {screenId}</summary>
        <p>{copy.intro}</p>
        <dl><dt>{copy.purpose}</dt><dd>{guide.screen.Purpose}</dd><dt>{copy.actors}</dt><dd>{guide.screen.Persona}</dd><dt>{copy.actions}</dt><dd>{guide.screen['Key actions']}</dd></dl>
        <h3>{copy.fields}</h3>
        {guide.formFields.length ? <div className={styles.table}><table><thead><tr><th>{copy.fields}</th><th>{copy.validation}</th><th>{copy.source}</th></tr></thead><tbody>{guide.formFields.map(({ row, cells }) => <tr key={row}><td>{cells['Section']} · {cells['Field label']} ({cells.Control})</td><td>{cells.Validation}</td><td>08_Form_Fields!A{row}</td></tr>)}</tbody></table></div> : <p>{copy.empty}</p>}
        <h3>{copy.steps}</h3>
        {guide.steps.length ? <ol>{guide.steps.map(({ row, cells }) => <li key={row}><strong>{cells['Process ID']} · {cells['Lane / actor']}</strong>: {cells['Action or decision']} <small>04_Process_Steps!A{row}</small></li>)}</ol> : <p>{copy.empty}</p>}
        {guide.rules.length > 0 && <><h3>{copy.rules}</h3><ul>{guide.rules.map(({ row, cells }) => <li key={row}><strong>{cells['Rule ID']}</strong>: {cells.Rule} — {cells['Client value / default']}</li>)}</ul></>}
    </details>;
}
