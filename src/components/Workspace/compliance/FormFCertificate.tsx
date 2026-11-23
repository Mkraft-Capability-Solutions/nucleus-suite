"use client";

import styles from "../ComplianceView.module.css";
import { NS, formatDate, formatNumber, printRecord, useT } from "./api";
import type { FormFView, Nominee } from "./types";

/** Form F preview, rendered only from the employee master, the legal entity and the declared nominees. */

export function useFormFPrint() {
  const { t, locale } = useT();
  return (view: FormFView) => {
    const reg = view.registration;
    if (!reg) return false;
    const nr = t(`${NS}.not_recorded`, "Not recorded");
    return printRecord({
      title: t(`${NS}.ff_print_title`, "Form F: Nomination under the Payment of Gratuity Act, 1972"),
      lang: locale,
      sections: [
        { rows: [
          [t(`${NS}.ff_establishment`, "Establishment"), view.establishment.name ?? nr],
          [t(`${NS}.ff_address`, "Address"), view.establishment.registeredAddress ?? nr],
          [t(`${NS}.ff_reg_no`, "Statutory registration no"), view.establishment.registrationNumber ?? nr],
        ] },
        { heading: t(`${NS}.ff_particulars`, "Employee particulars"), rows: [
          [t(`${NS}.ff_name`, "Name"), view.employee.name],
          [t(`${NS}.ff_token`, "Token no"), view.employee.employeeCode],
          [t(`${NS}.ff_department`, "Department"), view.employee.department],
          [t(`${NS}.ff_father_spouse`, "Father / spouse"), view.employee.fatherOrSpouseName ?? nr],
          [t(`${NS}.ff_joining`, "Date of appointment"), formatDate(view.employee.joiningDate, locale) ?? nr],
          [t(`${NS}.ff_permanent_address`, "Permanent address"), view.employee.permanentAddress ?? nr],
        ] },
        { heading: t(`${NS}.ff_nominees`, "Nominees"), table: {
          headers: [t(`${NS}.ff_col_nominee`, "Nominee name & address"), t(`${NS}.ff_col_relationship`, "Relationship"), t(`${NS}.ff_col_age`, "Age"), t(`${NS}.ff_col_share`, "Share %"), t(`${NS}.ff_col_contingency`, "Contingency")],
          rows: reg.nominees.map((n) => [`${n.name}${n.address ? `, ${n.address}` : ""}`, n.relationship, String(n.age), formatNumber(n.sharePercent, locale, 2), n.contingency ?? ""]),
        } },
        { heading: t(`${NS}.ff_witnesses`, "Witnesses"), rows: reg.witnesses.map((w, i) => [t(`${NS}.ff_witness_n`, "Witness {n}", { n: i + 1 }), w.name]) },
        { heading: t(`${NS}.ff_seal`, "Employer certificate"), rows: [
          [t(`${NS}.ff_serial`, "Registration serial"), reg.serial],
          [t(`${NS}.ff_registered_on`, "Registered on"), formatDate(reg.registeredAt, locale, true) ?? nr],
          [t(`${NS}.ff_declared_on`, "Declaration date"), formatDate(reg.declarationDate, locale) ?? nr],
        ] },
      ],
    });
  };
}

export default function FormFCertificate({ view, nominees, witnesses }: { view: FormFView; nominees: Nominee[]; witnesses: string[] }) {
  const { t, locale } = useT();
  const nr = t(`${NS}.not_recorded`, "Not recorded");
  const reg = view.registration;
  return (
    <div className={styles.formFCertificate}>
      <div className={styles.formFHeader}>
        <h2>{t(`${NS}.ff_form`, "FORM 'F'")}</h2>
        <h4>{t(`${NS}.ff_rule`, "[See sub-rule (1) of rule 6]")}</h4>
        <p><strong>{t(`${NS}.ff_heading`, "NOMINATION UNDER THE PAYMENT OF GRATUITY ACT, 1972")}</strong></p>
        <p className={styles.metaLine}>
          {t(`${NS}.ff_to`, "To: {name}", { name: view.establishment.name ?? nr })}<br />
          {view.establishment.registeredAddress ?? nr}
        </p>
      </div>
      <div className={styles.formFBody}>
        <p>{t(`${NS}.ff_declaration`, "I, {name}, whose particulars are given in the statement below, hereby nominate the person(s) mentioned below to receive the gratuity payable under the Payment of Gratuity Act, 1972, in the event of my death before that amount becomes payable, or having become payable has not been paid.", { name: view.employee.name })}</p>
        <div className={styles.inspectionBody}>
          <strong>{t(`${NS}.ff_particulars`, "Employee particulars")}</strong><br />
          {t(`${NS}.ff_name`, "Name")}: {view.employee.name} · {t(`${NS}.ff_sex`, "Sex")}: {view.employee.sex ?? nr} · {t(`${NS}.ff_marital`, "Marital status")}: {view.employee.maritalStatus ?? nr}<br />
          {t(`${NS}.ff_department`, "Department")}: {view.employee.department} · {t(`${NS}.ff_token`, "Token no")}: {view.employee.employeeCode}<br />
          {t(`${NS}.ff_joining`, "Date of appointment")}: {formatDate(view.employee.joiningDate, locale) ?? nr} · {t(`${NS}.ff_father_spouse`, "Father / spouse")}: {view.employee.fatherOrSpouseName ?? nr}
        </div>
        <table className={styles.formFTable}>
          <thead>
            <tr>
              <th scope="col">{t(`${NS}.ff_col_nominee`, "Nominee name & address")}</th>
              <th scope="col">{t(`${NS}.ff_col_relationship`, "Relationship")}</th>
              <th scope="col">{t(`${NS}.ff_col_age`, "Age")}</th>
              <th scope="col">{t(`${NS}.ff_col_share`, "Share %")}</th>
            </tr>
          </thead>
          <tbody>
            {nominees.length === 0 && <tr><td colSpan={4} className={styles.unavailable}>{t(`${NS}.ff_no_nominees`, "No nominees declared yet.")}</td></tr>}
            {nominees.map((n, i) => (
              <tr key={i}>
                <td><strong>{n.name || nr}</strong><br /><span className={styles.metaLine}>{n.address ?? ""}</span></td>
                <td>{n.relationship}</td>
                <td>{t(`${NS}.years_value`, "{n} yrs", { n: n.age })}</td>
                <td><strong>{formatNumber(n.sharePercent, locale, 2)}%</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.formFSignatures}>
          <div className={styles.sigBlock}><div className={styles.sigLine}>{t(`${NS}.ff_sig_employee`, "Signature / thumb impression of employee")}</div></div>
          {[0, 1].map((i) => (
            <div key={i} className={styles.sigBlock}><div className={styles.sigLine}>{t(`${NS}.ff_sig_witness`, "Witness {n} ({name})", { n: i + 1, name: witnesses[i] || nr })}</div></div>
          ))}
        </div>
        <div className={styles.formFEmployerSeal}>
          <strong>{t(`${NS}.ff_seal`, "Employer certificate")}</strong><br />
          <span className={styles.metaLine}>
            {reg
              ? t(`${NS}.ff_seal_registered`, "Registered under serial {serial} on {date}", { serial: reg.serial, date: formatDate(reg.registeredAt, locale) ?? nr })
              : t(`${NS}.ff_seal_pending`, "Not registered yet. The serial is issued when the nomination is registered.")}
          </span>
        </div>
      </div>
    </div>
  );
}
