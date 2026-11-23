"use client";

import styles from "./ExperienceView.module.css";
import { formatDateTime, useT } from "./engagement-client";
import { EXP_NS, type CapabilityView, type Loadable } from "./experience-model";

const NS = EXP_NS;

/** Latest persisted capability index (NCI) run for the signed-in employee; says so when no run exists. */
export default function ExperienceCapabilityTab({ state }: { state: Loadable<CapabilityView> }) {
  const { t, locale } = useT();
  if (state.status === "loading") return <p className={styles.card} aria-busy="true">{t(`${NS}.text_loading`, "Loading…")}</p>;
  if (state.status === "error") return <p className={styles.card} role="alert">{state.message}</p>;
  const { run, employeeName } = state.data;
  if (!run) {
    return <div className={styles.card}>{t(`${NS}.text_no_run`, "No capability index has been computed for {name} yet.", { name: employeeName })}</div>;
  }
  const number = new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: 1 });
  return (
    <div className={styles.container}>
      <section className={styles.mciHeroCard} aria-labelledby="nci-heading">
        <h3 id="nci-heading">{t(`${NS}.text_nci_title`, "Nucleus capability index")}</h3>
        <p>{t(`${NS}.text_nci_value`, "{name}: {value}", { name: employeeName, value: number.format(run.index) })}</p>
        <p>{t(`${NS}.text_nci_meta`, "Formula {formula}, computed {when}", { formula: run.formula, when: formatDateTime(run.computedAt, locale) })}</p>
        {!run.agrees && <p role="status">{t(`${NS}.text_nci_mismatch`, "The stored index does not match a recomputation from its inputs.")}</p>}
        <p>{t(`${NS}.text_nci_use`, "Permitted use: {use}", { use: run.permittedUse })}</p>
      </section>
      <div className={styles.dimensionGrid}>
        {run.components.map((component) => (
          <div key={component.key} className={styles.dimCard}>
            <strong>{t(`${NS}.dimension_${component.key}`, component.label)}</strong>
            <span>{number.format(component.value)}</span>
            <div>{t(`${NS}.text_dimension_weight`, "Weight {weight}, contributes {contribution}", { weight: number.format(component.weight), contribution: number.format(component.contribution) })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
