"use client";

import { ChevronRight } from "lucide-react";
import { getNavigationDomains } from "@/lib/workspace-navigation";
import { useTranslation } from "@/context/I18nContext";
import { stripConsoleCode } from "@/lib/display-codes";
import styles from "./Breadcrumb.module.css";

/** Breadcrumb derived from the navigation catalog: Nucleus Suite › module › group › page. Earlier crumbs navigate. */
type Item = { id: string; label: string };
type Group = { heading: string; items: Item[] };
type Domain = { id: string; label: string; groups: Group[] };
type Translate = (key: string, fallback?: string) => string;

export default function Breadcrumb({ activeDomain, activeSubFeature, onHome, onDomain }: {
  activeDomain: string; activeSubFeature: string; onHome: () => void; onDomain: (domainId: string) => void;
}) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const domains = getNavigationDomains() as Domain[];
  const domain = domains.find((d) => d.id === activeDomain);
  let group: Group | undefined;
  let item: Item | undefined;
  for (const g of domain?.groups ?? []) {
    const hit = g.items.find((i) => i.id === activeSubFeature);
    if (hit) { group = g; item = hit; break; }
  }
  const crumbs: Array<{ key: string; label: string; onClick?: () => void }> = [
    { key: "home", label: t("components.Workspace.Breadcrumb.text_home", "Nucleus Suite"), onClick: onHome },
  ];
  if (domain) crumbs.push({ key: "domain", label: t(domain.label), onClick: item ? () => onDomain(domain.id) : undefined });
  if (group) crumbs.push({ key: "group", label: t(group.heading) });
  if (item) crumbs.push({ key: "item", label: stripConsoleCode(t(item.label)) });

  return (
    <nav className={styles.crumbs} aria-label={t("components.Workspace.Breadcrumb.text_label", "Breadcrumb")}>
      <ol>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.key}>
              {last || !crumb.onClick
                ? <span className={last ? styles.current : undefined} aria-current={last ? "page" : undefined}>{crumb.label}</span>
                : <button type="button" onClick={crumb.onClick}>{crumb.label}</button>}
              {!last && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
