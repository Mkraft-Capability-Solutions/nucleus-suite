"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarClock, FolderOpen, GitBranch, Pencil, Printer } from "lucide-react";
import CareerHistory, { fetchCareer, formatDay } from "@/components/People/CareerHistory";
import { durationLabel, MOVEMENT_LABELS } from "@/lib/career";
import { launchAction } from "@/lib/action-launcher";
import { currencyDigits, formatMoney } from "@/lib/currencies";
import { downloadPrintableDocument } from "@/utils/exportUtils";
import { openDocuments } from "@/modules/documents/launcher";
import { Alert, Avatar, Badge, Button, Details, EmptyState, ErrorState, Panel, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import {
  formatDate, formatDateTime, humanise, STATUS_LABELS, tenure, useDocuments, useDossier, useEmployee, useTimeline,
  type ApiError, type EmployeeRecord,
} from "../data";
import { DocumentsTable } from "../sections/Registers";
import type { PersonRow } from "../sections/Directory";
import styles from "./EmployeeProfile.module.css";

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "job", label: "Job & reporting" },
  { id: "career", label: "Career history" },
  { id: "personal", label: "Personal" },
  { id: "contact", label: "Contact" },
  { id: "statutory", label: "Statutory & bank" },
  { id: "family", label: "Dependants" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

type Props = {
  person: PersonRow;
  organisation: string;
  canEdit: boolean;
  showCareer: boolean;
  onBack: () => void;
  onEdit: () => void;
  onOpenManager: (code: string) => void;
};

const text = (value: unknown): string | null => (value === null || value === undefined || String(value).trim() === "" ? null : String(value));

export default function EmployeeProfile({ person, organisation, canEdit, showCareer, onBack, onEdit, onOpenManager }: Props) {
  const [section, setSection] = useState<SectionId>("summary");
  const recordId = person.sample ? null : person.id;
  const record = useEmployee(recordId);
  const status = STATUS_LABELS[person.status];
  const sections = SECTIONS.filter((item) => showCareer || item.id !== "career");
  const meta = (record.data?.metadata ?? {}) as Record<string, unknown>;

  async function print() {
    const career = recordId && showCareer ? await fetchCareer(recordId) : null;
    const stints = career && "data" in career ? [...career.data.view.stints].reverse() : [];
    const profile: Record<string, string> = {
      "Employee code": person.employee_code,
      "Full name": person.name,
      Designation: text(person.designation) ?? "Not recorded",
      Department: text(person.department) ?? "Not recorded",
      Location: text(person.location) ?? "Not recorded",
      Status: status.label,
      "Work email": person.work_email ?? "Not recorded",
      "Joining date": formatDate(person.joining_date) || "Not recorded",
      "Reporting manager": person.manager_name ?? "Not recorded",
    };
    if (career && "data" in career) profile["Time in the group"] = durationLabel(career.data.view.totals.months);
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
    downloadPrintableDocument(
      escape(`Employee dossier: ${person.name} (${person.employee_code})`),
      Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, escape(value)])),
      ["From", "To", "Company", "Designation", "Department · location", "Move"],
      stints.length ? stints.map((stint) => [
        formatDay(stint.effectiveFrom), stint.current ? "Present" : formatDay(stint.endsOn), (stint.companyPath.join(" › ") || "Not recorded"),
        [stint.designation, stint.grade].filter(Boolean).join(" · ") || "Not recorded", [stint.department, stint.location].filter(Boolean).join(" · ") || "Not recorded",
        MOVEMENT_LABELS[stint.movementType],
      ].map(escape)) : [["No job history recorded", "", "", "", "", ""]],
      { organisation },
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>People</Button>
      </div>
      <header className={styles.header}>
        <Avatar name={person.name} size={56} />
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1 className={ui.pageTitle}>{person.name}</h1>
            <Badge tone={status.tone} dot>{status.label}</Badge>
            {person.sample && <Badge tone="warning">Sample</Badge>}
          </div>
          <p className={styles.headline}>{[text(person.designation), text(person.department), text(person.location)].filter((value) => value && value !== "—").join(" · ") || "No role recorded"}</p>
          <p className={styles.metaLine}>
            <span className={ui.mono}>{person.employee_code}</span>
            {person.joining_date && <span>Joined {formatDate(person.joining_date)} · {tenure(person.joining_date)}</span>}
            {person.manager_name && <span>Reports to {person.manager_code ? <button type="button" className={styles.inlineLink} onClick={() => onOpenManager(person.manager_code!)}>{person.manager_name}</button> : person.manager_name}</span>}
          </p>
        </div>
        <div className={cx(ui.actions, styles.headerActions)}>
          {!person.sample && <Button icon={CalendarClock} onClick={() => launchAction("oneOnOne", { participant: person.name })}>Schedule 1:1</Button>}
          <Button icon={Printer} onClick={() => void print()}>Print dossier</Button>
          {canEdit && !person.sample && <Button variant="primary" icon={Pencil} onClick={onEdit}>Edit</Button>}
        </div>
      </header>

      {person.sample && <Alert tone="warning">This person comes from the demo dataset (Administration › Sample data). It is not stored in the organisation&apos;s records, so only the directory details are available.</Alert>}

      <div className={styles.body}>
        <nav className={styles.nav} aria-label="Profile sections">
          <label className={styles.navSelectLabel} htmlFor="profile-section">Section</label>
          <select id="profile-section" className={cx(ui.select, styles.navSelect)} value={section} onChange={(event) => setSection(event.target.value as SectionId)}>
            {sections.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <ul className={styles.navList}>
            {sections.map((item) => (
              <li key={item.id}>
                <button type="button" className={styles.navItem} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>
                  {item.id === "career" && <GitBranch size={14} aria-hidden="true" />}{item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.content}>
          {person.sample ? <SampleSummary person={person} /> : record.error ? <ErrorState message={record.error.message} onRetry={() => void record.mutate()} /> : record.isLoading ? <Panel><SkeletonRows rows={5} columns={3} /></Panel> : (
            <>
              {section === "summary" && <Summary person={person} record={record.data!} meta={meta} />}
              {section === "job" && <Job person={person} record={record.data!} meta={meta} onOpenManager={onOpenManager} />}
              {section === "career" && <Panel title="Career history" subtitle="Every position held across the group's companies"><CareerHistory employeeRef={person.id} /></Panel>}
              {section === "personal" && <Personal meta={meta} />}
              {section === "contact" && <Contact employeeId={person.id} meta={meta} />}
              {section === "statutory" && <Statutory employeeId={person.id} />}
              {section === "family" && <Family employeeId={person.id} meta={meta} />}
              {section === "documents" && <EmployeeDocuments employeeId={person.id} code={person.employee_code} />}
              {section === "activity" && <Activity employeeId={person.id} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SampleSummary({ person }: { person: PersonRow }) {
  return (
    <Panel title="Directory details">
      <Details items={[
        { label: "Employee code", value: person.employee_code }, { label: "Designation", value: text(person.designation) },
        { label: "Department", value: text(person.department) }, { label: "Location", value: text(person.location) },
        { label: "Reporting manager", value: person.manager_name }, { label: "Worker class", value: person.worker_class },
      ]} />
    </Panel>
  );
}

function Summary({ person, record, meta }: { person: PersonRow; record: EmployeeRecord; meta: Record<string, unknown> }) {
  return (
    <div className={styles.stack}>
      <Panel title="At a glance">
        <Details items={[
          { label: "Designation", value: text(record.designation) ?? text(person.designation) },
          { label: "Department", value: text(record.department) ?? text(person.department) },
          { label: "Location", value: text(record.location) ?? text(person.location) },
          { label: "Reporting manager", value: person.manager_name },
          { label: "Date of joining", value: formatDate(record.joiningDate) },
          { label: "Length of service", value: tenure(record.joiningDate) },
          { label: "Work email", value: record.workEmail },
          { label: "Mobile", value: text(meta.mobile) },
          { label: "Worker category", value: text(meta.workerCategory) ?? humanise(record.category) },
        ]} />
      </Panel>
    </div>
  );
}

function Job({ person, record, meta, onOpenManager }: { person: PersonRow; record: EmployeeRecord; meta: Record<string, unknown>; onOpenManager: (code: string) => void }) {
  return (
    <div className={styles.stack}>
      <Panel title="Position">
        <Details items={[
          { label: "Designation", value: text(record.designation) },
          { label: "Department", value: text(record.department) },
          { label: "Location", value: text(record.location) },
          { label: "Band / grade", value: person.band },
          { label: "Worker class", value: person.worker_class ?? text(meta.workerClass) },
          { label: "Worker category", value: text(meta.workerCategory) },
          { label: "Status", value: humanise(record.status) },
          { label: "Date of joining", value: formatDate(record.joiningDate) },
          { label: "Effective from", value: formatDate(text(meta.effectiveFrom)) },
        ]} />
      </Panel>
      <Panel title="Reporting">
        <Details items={[
          { label: "Reporting manager", value: person.manager_name ? (person.manager_code ? <button type="button" className={styles.inlineLink} onClick={() => onOpenManager(person.manager_code!)}>{person.manager_name}</button> : person.manager_name) : null },
          { label: "Manager's employee code", value: person.manager_code },
        ]} />
      </Panel>
      <Panel title="Time and pay rules">
        <Details items={[
          { label: "Shift", value: text(meta.assignedShift) },
          { label: "Overtime eligibility", value: humanise(text(meta.otEligibility)) },
          { label: "Weekly rest days", value: meta.hasRestDays === undefined ? null : meta.hasRestDays ? "Yes" : "No" },
          { label: "Salary processed at", value: text(meta.salaryLocationScope) },
          { label: "Basic salary", value: record.salaryMasked ? `Restricted${record.currency ? ` · paid in ${record.currency}` : ""}` : record.basicSalary ? `${formatMoney(record.basicSalary.minor ?? Math.round(Number(record.basicSalary.amount) * 10 ** currencyDigits(record.basicSalary.currency)), record.basicSalary.currency)} a month` : null },
        ]} />
      </Panel>
    </div>
  );
}

function Personal({ meta }: { meta: Record<string, unknown> }) {
  return (
    <div className={styles.stack}>
      <Panel title="Identity">
        <Details items={[
          { label: "Full legal name", value: text(meta.fullLegalName) ?? text(meta.fullName) },
          { label: "Name as per bank", value: text(meta.nameAsPerBank) },
          { label: "Former name", value: text(meta.formerName) },
          { label: "Gender", value: text(meta.gender) },
          { label: "Date of birth", value: formatDate(text(meta.dateOfBirth)) },
          { label: "Blood group", value: text(meta.bloodGroup) },
          { label: "Nationality", value: text(meta.nationality) },
          { label: "Place of birth", value: text(meta.placeOfBirth) },
          { label: "Mother tongue", value: text(meta.motherTongue) },
          { label: "Social category", value: text(meta.socialCategory) },
          { label: "Person with disability", value: meta.isDifferentlyAbled === true ? `Yes${meta.disabilityType ? ` · ${meta.disabilityType}` : ""}${meta.disabilityPercent ? ` · ${meta.disabilityPercent}%` : ""}` : meta.isDifferentlyAbled === false ? "No" : null },
        ]} />
      </Panel>
      <Panel title="Family">
        <Details items={[
          { label: "Marital status", value: text(meta.maritalStatus) },
          { label: "Date of marriage", value: formatDate(text(meta.marriageDate)) },
          { label: "Father's name", value: text(meta.fatherName) },
          { label: "Mother's name", value: text(meta.motherName) },
          { label: "Spouse's name", value: text(meta.spouseName) },
        ]} />
      </Panel>
      <Panel title="Education and experience" flush>
        <RecordList empty="No qualifications recorded." rows={Array.isArray(meta.education) ? meta.education as Array<Record<string, unknown>> : []}
          columns={[["Level", "level"], ["Degree", "degree"], ["Institute", "institute"], ["Year", "passingYear"], ["Score", "score"]]} />
        <div className={styles.divider} />
        <RecordList empty="No previous employment recorded." rows={Array.isArray(meta.experience) ? meta.experience as Array<Record<string, unknown>> : []}
          columns={[["Employer", "employer"], ["Designation", "designation"], ["From", "fromDate"], ["To", "toDate"], ["Reason for leaving", "reasonForLeaving"]]} />
      </Panel>
    </div>
  );
}

function RecordList({ rows, columns, empty }: { rows: Array<Record<string, unknown>>; columns: Array<[string, string]>; empty: string }) {
  const filled = rows.filter((row) => columns.some(([, key]) => text(row[key])));
  if (filled.length === 0) return <p className={styles.emptyLine}>{empty}</p>;
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{filled.map((row, index) => <tr key={index}>{columns.map(([label, key]) => <td key={label}>{/date|Date/.test(key) ? formatDate(text(row[key])) || "—" : text(row[key]) ?? "—"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** A dossier resource as a list; 403 shows an access message rather than an error. */
function DossierList({ resource, employeeId, title, fields, empty }: { resource: string; employeeId: string; title: string; fields: Array<[string, string]>; empty: string }) {
  const rows = useDossier(resource, employeeId);
  const forbidden = (rows.error as ApiError | undefined)?.status === 403;
  return (
    <Panel title={title} flush>
      {forbidden ? <EmptyState title="You do not have access">Your role cannot view {title.toLowerCase()}.</EmptyState>
        : rows.error ? <div style={{ padding: 16 }}><ErrorState message={rows.error.message} onRetry={() => void rows.mutate()} /></div>
        : rows.isLoading ? <SkeletonRows rows={2} columns={3} />
        : <RecordList empty={empty} rows={(rows.data ?? []).map((row) => ({ ...(row.attributes ?? {}), ...row }))} columns={fields} />}
    </Panel>
  );
}

function Contact({ employeeId, meta }: { employeeId: string; meta: Record<string, unknown> }) {
  const address = [text(meta.presentAddr1), text(meta.presentAddr2), text(meta.presentCity), text(meta.presentDistrict), text(meta.presentState), text(meta.presentPin), text(meta.presentCountry)].filter(Boolean).join(", ");
  return (
    <div className={styles.stack}>
      <Panel title="Contact on the employee record">
        <Details items={[
          { label: "Mobile", value: text(meta.mobile) },
          { label: "Alternate mobile", value: text(meta.altMobile) },
          { label: "Personal email", value: text(meta.personalEmail) },
          { label: "Work email", value: text(meta.officialEmail) ?? text(meta.workEmail) },
          { label: "Present address", value: address || null },
          { label: "Permanent address", value: meta.permanentSameAsPresent === true ? "Same as present address" : text(meta.permanentAddress) },
          { label: "Emergency contact", value: [text(meta.emergencyName) ?? text(meta.emergencyContactName), text(meta.emergencyRelation), text(meta.emergencyPhone) ?? text(meta.emergencyContactPhone)].filter(Boolean).join(" · ") || null },
          { label: "Second emergency contact", value: [text(meta.emergencySecondaryName), text(meta.emergencySecondaryRelation), text(meta.emergencySecondaryPhone)].filter(Boolean).join(" · ") || null },
        ]} />
      </Panel>
      <DossierList resource="contacts" employeeId={employeeId} title="Contact records" empty="No contact records in the dossier." fields={[["Type", "contactType"], ["Value", "value"], ["City", "city"], ["State", "state"]]} />
      <DossierList resource="emergency" employeeId={employeeId} title="Emergency contacts" empty="No emergency contacts in the dossier." fields={[["Name", "name"], ["Relationship", "relationship"], ["Phone", "phone"], ["Alternate phone", "alternatePhone"]]} />
    </div>
  );
}

function Statutory({ employeeId }: { employeeId: string }) {
  return (
    <div className={styles.stack}>
      <DossierList resource="tax" employeeId={employeeId} title="Tax and statutory identifiers" empty="No statutory identifiers recorded." fields={[["PAN", "taxIdentifier"], ["Financial year", "financialYear"], ["Regime", "regime"], ["Residency", "residencyStatus"]]} />
      <DossierList resource="bank" employeeId={employeeId} title="Bank accounts" empty="No bank account recorded." fields={[["Account holder", "accountHolder"], ["Bank", "bankName"], ["Branch", "branch"], ["Account", "accountNumber"], ["IFSC", "routingCode"], ["Type", "accountType"]]} />
      <DossierList resource="employments" employeeId={employeeId} title="Employment contracts" empty="No employment contracts recorded." fields={[["Contract type", "contractType"], ["From", "effectiveFrom"], ["To", "effectiveTo"], ["Reference", "contractReference"]]} />
    </div>
  );
}

function Family({ employeeId, meta }: { employeeId: string; meta: Record<string, unknown> }) {
  return (
    <div className={styles.stack}>
      <DossierList resource="dependants" employeeId={employeeId} title="Dependants and nominees" empty="No dependants recorded in the dossier." fields={[["Name", "name"], ["Relationship", "relationship"], ["Date of birth", "birthDate"], ["Insured", "insured"], ["Nomination %", "nominationPercent"]]} />
      <Panel title="Dependants on the employee form" flush>
        <RecordList empty="None recorded on the form." rows={Array.isArray(meta.dependants) ? meta.dependants as Array<Record<string, unknown>> : []} columns={[["Name", "name"], ["Relation", "relation"], ["Date of birth", "dob"], ["Gender", "gender"]]} />
        <div className={styles.divider} />
        <RecordList empty="No nominees on the form." rows={Array.isArray(meta.nominees) ? meta.nominees as Array<Record<string, unknown>> : []} columns={[["Nominee", "name"], ["Relation", "relation"], ["Scheme", "scheme"], ["Share %", "sharePercent"]]} />
      </Panel>
    </div>
  );
}

/** The person's documents; a document opens in the document library, in this person's folder. */
function EmployeeDocuments({ employeeId, code }: { employeeId: string; code: string }) {
  const documents = useDocuments();
  const rows = useMemo(() => (documents.data ?? []).filter((row) => row.employee_code === code), [documents.data, code]);
  return (
    <Panel title="Documents" subtitle="From the document vault. Select a document to open it in the library." flush
      actions={<Button size="sm" icon={FolderOpen} onClick={() => openDocuments({ employee: employeeId })}>Open folder</Button>}>
      <DocumentsTable rows={rows} loading={documents.isLoading} error={documents.error?.message ?? null} onRetry={() => void documents.mutate()} total={rows.length} showEmployee={false}
        onOpenDocument={(row) => openDocuments({ employee: employeeId, document: row.id })} />
    </Panel>
  );
}

function Activity({ employeeId }: { employeeId: string }) {
  const timeline = useTimeline(employeeId);
  const rows = timeline.data?.auditTrail ?? [];
  let body: ReactNode;
  if (timeline.error) body = <div style={{ padding: 16 }}><ErrorState message={timeline.error.message} onRetry={() => void timeline.mutate()} /></div>;
  else if (timeline.isLoading) body = <SkeletonRows rows={4} columns={3} />;
  else if (rows.length === 0) body = <EmptyState title="No activity recorded">Changes to this employee&apos;s record appear here.</EmptyState>;
  else body = (
    <ol className={styles.activity}>
      {rows.map((row) => (
        <li key={row.id}>
          <span className={styles.activityWhen}>{formatDateTime(row.created_at)}</span>
          <span className={styles.activityWhat}>{humanise(row.action)}</span>
          {row.reason && <span className={styles.activityWhy}>{row.reason}</span>}
        </li>
      ))}
    </ol>
  );
  return <Panel title="Activity" subtitle="The 20 most recent changes to this record" flush>{body}</Panel>;
}
