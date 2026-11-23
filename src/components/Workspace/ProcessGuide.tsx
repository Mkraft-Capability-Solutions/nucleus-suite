"use client";

import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import { useT } from "@/hooks/useT";
import { processGuideFor } from "@/lib/process-guide";
import styles from "./ProcessGuide.module.css";

/** Collapsible process-workbook reference for an operational screen (documentation, not records). */
const NS = "components.Workspace.ProcessGuide";

export default function ProcessGuide({ screenId }: { screenId: string }) {
  const { t } = useT();
  const guide = processGuideFor(screenId);
  if (!guide) return null;
  const { screen } = guide;
  const screenTitle = screen["Screen name"] || screen.Screen || screen.Title || screen.Purpose || screenId;
  const empty = t(`${NS}.text_empty`, "No detailed rows are specified for this screen in the process workbook.");

  return (
    <details className={styles.guide}>
      <summary>
        <MenuBookOutlined fontSize="small" aria-hidden="true" />
        {t(`${NS}.text_title_for`, "Process guide · {screen}", { screen: screenTitle })}
      </summary>
      <p>{t(`${NS}.text_intro`, "Reference workflow from the Nucleus process workbook for this screen.")}</p>
      <dl>
        <dt>{t(`${NS}.text_purpose`, "Purpose")}</dt>
        <dd>{screen.Purpose || "—"}</dd>
        <dt>{t(`${NS}.text_actors`, "Who uses this")}</dt>
        <dd>{screen.Persona || "—"}</dd>
        <dt>{t(`${NS}.text_actions`, "Required actions")}</dt>
        <dd>{screen["Key actions"] || "—"}</dd>
      </dl>
      <h3>{t(`${NS}.text_fields`, "Form requirements")}</h3>
      {guide.formFields.length ? (
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t(`${NS}.text_fields`, "Form requirements")}</th>
                <th scope="col">{t(`${NS}.text_validation`, "Validation")}</th>
                <th scope="col">{t(`${NS}.text_specification`, "Specification")}</th>
              </tr>
            </thead>
            <tbody>
              {guide.formFields.map(({ row, cells }) => (
                <tr key={row}>
                  <td>{t(`${NS}.text_field_cell`, "{section} · {label} ({control})", { section: cells.Section ?? "", label: cells["Field label"] ?? "", control: cells.Control ?? "" })}</td>
                  <td>{cells.Validation}</td>
                  <td>{t(`${NS}.text_field_number`, "Field #{row}", { row })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{empty}</p>
      )}
      <h3>{t(`${NS}.text_steps`, "Process steps")}</h3>
      {guide.steps.length ? (
        <ol>
          {guide.steps.map(({ row, cells }) => (
            <li key={row}>
              <strong>{cells["Lane / actor"]}</strong>
              {t(`${NS}.text_step_separator`, ": ")}
              {cells["Action or decision"]}
            </li>
          ))}
        </ol>
      ) : (
        <p>{empty}</p>
      )}
      {guide.rules.length > 0 && (
        <>
          <h3>{t(`${NS}.text_rules`, "Business rules")}</h3>
          <ul>
            {guide.rules.map(({ row, cells }) => (
              <li key={row}>
                <strong>{cells["Rule ID"]}</strong>
                {t(`${NS}.text_step_separator`, ": ")}
                {cells.Rule}
                {cells["Client value / default"] ? ` (${cells["Client value / default"]})` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
