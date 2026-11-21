"use client";

import { useCallback, useMemo, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { useSWRConfig } from "swr";
import { Download, FileText, History, LayoutDashboard, Layers, Network, Upload, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useHRMS } from "@/context/HRMSContext";
import { getWorkbookRowsForModule, recordCellValue } from "@/lib/demo-workbook-adapter.mjs";
import { downloadCSV } from "@/utils/exportUtils";
import BulkOnboardingModal from "@/components/Workspace/BulkOnboardingModal";
import { Button, MenuButton, PageHeader, Scope, ui } from "@/design/redesign/ui";
import { STATUS_LABELS, fullName, usePeople, type DirectoryRow, type DirectoryStatus } from "./data";
import Directory, { type PersonRow } from "./sections/Directory";
import { Audit, Documents, Organisation, Overview, Positions } from "./sections/Registers";
import EmployeeProfile from "./profile/EmployeeProfile";
import EmployeeForm from "./form/EmployeeForm";

type SectionId = "overview" | "directory" | "organisation" | "positions" | "documents" | "audit";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Users }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "directory", label: "Directory", icon: Users },
  { id: "organisation", label: "Organisation", icon: Network },
  { id: "positions", label: "Positions", icon: Layers },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "audit", label: "Audit trail", icon: History },
];

/** Navigation sub-features (navigation.catalog.json) → the section that holds them. */
export function sectionForSubFeature(subFeature: string | null | undefined, tab?: string): SectionId {
  if (tab === "team") return "organisation";
  switch (subFeature) {
    case "legal_entity": case "entities": case "location_master": case "locations": case "orgchart": case "org_chart": case "core_org":
      return "organisation";
    case "position_register": case "positions": case "sanctioned_strength": case "manpower":
      return "positions";
    case "document_vault": case "documents":
      return "documents";
    case "audit":
      return "audit";
    case "core_people": case "people_core": case "overview":
      return "overview";
    default:
      return "directory";
  }
}

const EDIT_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "HR_MANAGER"]);

function toStatus(raw: string | undefined): DirectoryStatus {
  const value = String(raw ?? "").toLowerCase();
  if (["separated", "exited", "relieved"].includes(value)) return "separated";
  if (["archived", "inactive"].includes(value)) return "archived";
  if (value.includes("leave")) return "on_leave";
  return "active";
}

export default function CoreHrWorkspace({ activeSubFeature, tab }: { activeSubFeature?: string | null; tab?: string }) {
  const { user, isEntitled, tenantAccess } = useAuth() as {
    user?: { role?: string }; isEntitled: (key: string) => boolean; tenantAccess?: { tenant?: { name?: string } } | null;
  };
  const { showToast } = (useHRMS() ?? {}) as { showToast?: (title: string, message: string, type?: string) => void };
  const people = usePeople();
  const { mutate: mutateCache } = useSWRConfig();
  const [section, setSection] = useState<SectionId>(() => sectionForSubFeature(activeSubFeature, tab));
  const [lastSubFeature, setLastSubFeature] = useState(activeSubFeature);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "create" | "edit"; id: string | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Navigating from the menu to another People screen moves to its section.
  if (activeSubFeature !== lastSubFeature) {
    setLastSubFeature(activeSubFeature);
    setSection(sectionForSubFeature(activeSubFeature, tab));
    setOpenPersonId(null);
  }

  const canEdit = EDIT_ROLES.has(String(user?.role ?? "").toUpperCase());
  const organisation = tenantAccess?.tenant?.name ?? "";
  const showSample = Boolean(tenantAccess) && isEntitled("administration.sample_data");

  const rows = useMemo<PersonRow[]>(() => {
    const real = (people.data?.directory ?? []).map((row) => ({ ...row, name: fullName(row) }));
    if (!showSample) return real;
    const codes = new Set(real.map((row) => row.employee_code));
    const sample = (getWorkbookRowsForModule("person_record") as Array<{ source: Record<string, string> }>)
      .filter((record) => record.source["Employee code"] && !codes.has(record.source["Employee code"]))
      .map((record): PersonRow => {
        const [first = "", ...rest] = String(record.source["Full name"] ?? "").split(" ");
        const row: DirectoryRow = {
          id: `sample:${record.source["Employee code"]}`, employee_code: record.source["Employee code"], first_name: first, last_name: rest.join(" "),
          designation: String(recordCellValue(record, "Position") ?? record.source["Designation"] ?? "—"), department: String(recordCellValue(record, "Department") ?? record.source["Org unit"] ?? "—"),
          location: String(recordCellValue(record, "Location") ?? record.source["Location"] ?? "—"), band: record.source["Band"] ?? null, worker_class: record.source["Worker class"] ?? null,
          manager_code: record.source["Manager code"] ?? null, manager_name: record.source["Manager name"] ?? null, joining_date: record.source["Date of joining"] ?? null,
          work_email: null, record_status: record.source["Status"] ?? "", status: toStatus(record.source["Status"]),
        };
        return { ...row, name: String(record.source["Full name"] ?? fullName(row)), sample: true };
      });
    return [...real, ...sample];
  }, [people.data, showSample]);

  const openPerson = rows.find((row) => row.id === openPersonId) ?? null;
  const open = useCallback((row: PersonRow) => setOpenPersonId(row.id), []);
  const openByCode = useCallback((code: string) => { const row = rows.find((item) => item.employee_code === code); if (row) setOpenPersonId(row.id); }, [rows]);
  const openById = useCallback((id: string) => { if (rows.some((row) => row.id === id)) setOpenPersonId(id); }, [rows]);
  const edit = useCallback((row: PersonRow) => setForm({ mode: "edit", id: row.id }), []);
  const add = useCallback(() => setForm({ mode: "create", id: null }), []);

  const activeCount = rows.filter((row) => row.status === "active" && !row.sample).length;
  const counts: Partial<Record<SectionId, number>> = { directory: rows.length };

  function exportAll() {
    downloadCSV(
      `employees-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Employee code", "Name", "Designation", "Department", "Location", "Manager", "Joined", "Status", "Work email"],
      rows.filter((row) => !row.sample).map((row) => [row.employee_code, row.name, row.designation, row.department, row.location, row.manager_name ?? "", row.joining_date ?? "", STATUS_LABELS[row.status].label, row.work_email ?? ""]),
    );
  }

  return (
    <Scope module="core-hr">
      <div className={ui.page}>
        {openPerson ? (
          <EmployeeProfile
            key={openPerson.id}
            person={openPerson}
            organisation={organisation}
            canEdit={canEdit}
            showCareer={isEntitled("people.records.career_history")}
            onBack={() => setOpenPersonId(null)}
            onEdit={() => edit(openPerson)}
            onOpenManager={openByCode}
          />
        ) : (
          <>
            <PageHeader
              eyebrow="Core HR"
              title="People"
              description={people.data ? `${organisation ? `${organisation} · ` : ""}${activeCount.toLocaleString("en-IN")} active ${activeCount === 1 ? "employee" : "employees"}` : "Employee records, organisation structure, positions and documents."}
              actions={
                <>
                  <MenuButton label="Export" icon={Download} actions={[{ label: "Directory as CSV", icon: Download, onSelect: exportAll, disabled: rows.length === 0 }]} />
                  {canEdit && <Button icon={Upload} onClick={() => setImportOpen(true)}>Import</Button>}
                  {canEdit && <Button variant="primary" icon={UserPlus} onClick={add}>Add employee</Button>}
                </>
              }
            />
            <Tabs.Root value={section} onValueChange={(value) => setSection(value as SectionId)}>
              <Tabs.List className={ui.tabsList} aria-label="People sections">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <Tabs.Tab key={id} value={id} className={ui.tab}>
                    <Icon aria-hidden="true" />{label}{counts[id] !== undefined && <span className={ui.tabCount}>{counts[id]}</span>}
                  </Tabs.Tab>
                ))}
                <Tabs.Indicator className={ui.tabIndicator} />
              </Tabs.List>
              <div style={{ marginTop: 16 }}>
                <Tabs.Panel value="overview"><Overview data={people.data} people={rows} onOpen={open} onShow={(id) => setSection(id as SectionId)} /></Tabs.Panel>
                <Tabs.Panel value="directory">
                  <Directory rows={rows} loading={people.isLoading} error={people.error?.message ?? null} onRetry={() => void people.mutate()} canEdit={canEdit} onOpen={open} onEdit={edit} onAdd={add} />
                </Tabs.Panel>
                <Tabs.Panel value="organisation"><Organisation data={people.data} people={rows} canSeeGroup={isEntitled("people.legal_entities.group_structure")} onOpen={open} /></Tabs.Panel>
                <Tabs.Panel value="positions"><Positions /></Tabs.Panel>
                <Tabs.Panel value="documents"><Documents onOpenEmployee={openByCode} /></Tabs.Panel>
                <Tabs.Panel value="audit"><Audit rows={people.data ? people.data.auditTrail : people.error ? null : []} onOpenEmployee={openById} /></Tabs.Panel>
              </div>
            </Tabs.Root>
          </>
        )}
      </div>

      <EmployeeForm
        open={form !== null}
        mode={form?.mode ?? "create"}
        employeeId={form?.id ?? null}
        directory={people.data?.directory ?? []}
        onClose={() => setForm(null)}
        onSaved={({ id, name, mode }) => {
          setForm(null);
          void people.mutate();
          void mutateCache((key) => typeof key === "string" && key.startsWith(`/api/v1/people/${id}`));
          void mutateCache((key) => typeof key === "string" && key.startsWith(`/api/v1/career-history/`));
          showToast?.(mode === "edit" ? "Employee updated" : "Employee added", `${name} has been ${mode === "edit" ? "updated" : "added"}.`, "success");
          if (mode === "create") setOpenPersonId(id);
        }}
      />
      <BulkOnboardingModal isOpen={importOpen} onClose={() => { setImportOpen(false); void people.mutate(); }} onIngest={() => void people.mutate()} />
    </Scope>
  );
}
