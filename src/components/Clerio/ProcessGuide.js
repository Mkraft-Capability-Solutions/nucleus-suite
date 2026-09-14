'use client';
import { useTranslation } from '@/context/I18nContext';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { readData } from '@/services/workspace-data.mjs';
import styles from './ProcessGuide.module.css';

export default function ProcessGuide({ screenId }) {
  const { t: translateText } = useTranslation();

  const guide = readData('process.requirements', 'screens')[screenId];
  const copy = readData('process.requirements', 'copy');
  if (!guide) return null;

  const screenTitle = guide.screen['Screen name'] || guide.screen.Title || guide.screen.Purpose || screenId;

  return (
    <details className={styles.guide}>
      <summary>
        <MenuBookOutlined fontSize="small" />
        {copy.title}
        {translateText('components.Clerio.ProcessGuide', 'text_588da41053')}
        {screenTitle}
      </summary>
      <p>{copy.intro}</p>
      <dl>
        <dt>{copy.purpose}</dt>
        <dd>{guide.screen.Purpose}</dd>
        <dt>{copy.actors}</dt>
        <dd>{guide.screen.Persona}</dd>
        <dt>{copy.actions}</dt>
        <dd>{guide.screen['Key actions']}</dd>
      </dl>
      <h3>{copy.fields}</h3>
      {guide.formFields.length ? (
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>{copy.fields}</th>
                <th>{copy.validation}</th>
                <th>Specification</th>
              </tr>
            </thead>
            <tbody>
              {guide.formFields.map(({ row, cells }) => (
                <tr key={row}>
                  <td>
                    {cells.Section}
                    {translateText('components.Clerio.ProcessGuide', 'text_588da41053')}
                    {cells['Field label']}
                    {translateText('components.Clerio.ProcessGuide', 'text_4f5a2ada11')}
                    {cells.Control}
                    {translateText('components.Clerio.ProcessGuide', 'text_ba5ec51d07')}
                  </td>
                  <td>{cells.Validation}</td>
                  <td>Field #{row}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{copy.empty}</p>
      )}
      <h3>{copy.steps}</h3>
      {guide.steps.length ? (
        <ol>
          {guide.steps.map(({ row, cells }) => (
            <li key={row}>
              <strong>
                {cells['Lane / actor']}
              </strong>
              {translateText('components.Clerio.ProcessGuide', 'text_45822f54a0')}
              {cells['Action or decision']}
            </li>
          ))}
        </ol>
      ) : (
        <p>{copy.empty}</p>
      )}
      {guide.rules.length > 0 && (
        <>
          <h3>{copy.rules}</h3>
          <ul>
            {guide.rules.map(({ row, cells }) => (
              <li key={row}>
                <strong>{cells['Rule ID']}</strong>
                {translateText('components.Clerio.ProcessGuide', 'text_45822f54a0')}
                {cells.Rule}
                {translateText('components.Clerio.ProcessGuide', 'text_3b2e8119b6')}
                {cells['Client value / default']}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
