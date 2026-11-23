"use client";

import NextImage from "next/image";
import { Calendar, Clock, Mail, MapPin, MessageSquare } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import { avatarDataUri } from "@/lib/avatar";
import type { Member } from "./data";
import { label } from "./labels";
import styles from "../TeamView.module.css";

export default function MemberCard({ member }: { member: Member }) {
  const { t } = useTranslation();
  return (
    <div className={styles.teamCard}>
      <div className={styles.cardTop}>
        <div className={styles.avatarWrapper}>
          <NextImage unoptimized width={48} height={48} src={avatarDataUri(member.name)} className={styles.avatar} alt="" />
        </div>
        <div className={styles.memberHeaderInfo}>
          <h3 className={styles.memberName}>{member.name}</h3>
          <div className={styles.memberRole}>{member.role ?? label(t, "noRole")}</div>
          <span className={styles.podBadge}>{member.dept ?? label(t, "noDepartment")}</span>
        </div>
      </div>
      <div className={styles.memberDetails}>
        <div className={styles.detailRow}><MapPin size={14} aria-hidden="true" /><span>{member.location ?? label(t, "noLocation")}</span></div>
        <div className={styles.detailRow}><Clock size={14} aria-hidden="true" /><span>{member.shift ?? label(t, "noShift")}</span></div>
        <div className={styles.detailRow}><Mail size={14} aria-hidden="true" /><span>{member.email ?? label(t, "noEmail")}</span></div>
      </div>
      {member.skills.length > 0 && (
        <div className={styles.skillsRow}>
          {member.skills.map((skill) => <span key={skill} className={styles.skillPill}>{skill}</span>)}
        </div>
      )}
      <div className={styles.contactRow}>
        <button type="button" className={`${styles.contactBtn} ${styles.contactBtnPrimary}`} disabled title={label(t, "dmTitle")}>
          <MessageSquare size={14} aria-hidden="true" /> {label(t, "dm")}
        </button>
        {member.email ? (
          <a className={styles.contactBtn} href={`mailto:${member.email}`} title={label(t, "emailTitle")}>
            <Mail size={14} aria-hidden="true" /> {label(t, "email")}
          </a>
        ) : (
          <button type="button" className={styles.contactBtn} disabled title={label(t, "noEmail")}>
            <Mail size={14} aria-hidden="true" /> {label(t, "email")}
          </button>
        )}
        <button type="button" className={styles.contactBtn} onClick={() => launchAction("oneOnOne", { participant: member.name, employeeId: member.id })} title={label(t, "oneOnOneTitle")}>
          <Calendar size={14} aria-hidden="true" /> {label(t, "oneOnOne")}
        </button>
      </div>
    </div>
  );
}
