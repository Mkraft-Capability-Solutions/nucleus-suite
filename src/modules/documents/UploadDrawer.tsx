"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileUp, Upload } from "lucide-react";
import { Alert, Button, Drawer, Field, Input, Select, cx } from "@/design/redesign/ui";
import { ACCEPT, MAX_DOCUMENT_BYTES, formatBytes } from "@/lib/documents/file-types";
import { uploadDocument, type LibraryTree } from "./data";
import styles from "./Documents.module.css";

/**
 * Add a document to a person's folder. HR picks the person (the open folder's person is chosen
 * already); everyone else adds to their own folder. The file is checked by its bytes on the server.
 */
export default function UploadDrawer({ tree, defaultEmployee, onClose, onUploaded }: {
  tree: LibraryTree; defaultEmployee: string | null; onClose: () => void; onUploaded: (title: string, verification: string, employeeId: string) => void;
}) {
  const selfOnly = tree.reach.write === "self";
  const [employeeId, setEmployeeId] = useState(selfOnly ? tree.me ?? "" : defaultEmployee ?? "");
  const [typeId, setTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const people = tree.companies.flatMap((company) => company.departments.flatMap((department) => department.employees.map((employee) => ({ ...employee, company: company.name, department: department.name }))));
  const person = people.find((entry) => entry.id === employeeId);
  const typeName = tree.types.find((entry) => entry.id === typeId)?.name ?? "";
  const suggested = typeName && person ? `${typeName} – ${person.name}` : "";
  const today = new Date().toISOString().slice(0, 10);

  function choose(next: File | null) {
    setError(null);
    if (!next) return;
    if (next.size > MAX_DOCUMENT_BYTES) { setError(`"${next.name}" is ${formatBytes(next.size)}; files are limited to 10 MB.`); return; }
    setFile(next);
  }
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0] ?? null); };

  async function submit() {
    setError(null);
    const finalTitle = (titleTouched ? title : title || suggested).trim();
    if (!employeeId) return setError("Choose whose folder this goes in.");
    if (!typeId) return setError("Choose the document type.");
    if (!finalTitle) return setError("Give the document a title.");
    if (!file) return setError("Choose a file to upload.");
    if (issuedOn && issuedOn > today) return setError("The issue date cannot be in the future.");
    if (expiresOn && issuedOn && expiresOn <= issuedOn) return setError("The expiry date must be after the issue date.");
    setBusy(true);
    try {
      const created = await uploadDocument({ employeeId, documentTypeId: typeId, title: finalTitle, documentNumber: number, issuedOn, expiresOn, file });
      onUploaded(finalTitle, created.verification, employeeId);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  // People grouped by company and department, the way the folders are.
  const groups = tree.companies.flatMap((company) => company.departments.map((department) => ({ label: `${company.name} · ${department.name}`, employees: department.employees })));

  return (
    <Drawer open onOpenChange={(open) => { if (!open && !busy) onClose(); }} title="Upload a document"
      description={selfOnly ? "Add a document to your own folder. HR verifies what you add." : "File a document in a person's folder."}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" icon={Upload} loading={busy} onClick={() => void submit()}>Upload</Button></>}>
      <div className={styles.form}>
        {error && <Alert tone="danger">{error}</Alert>}
        {selfOnly ? (
          <Field id="upload-person" label="Folder"><Input id="upload-person" value={person ? `${person.name} · ${person.department}` : "Your folder"} readOnly /></Field>
        ) : (
          <Field id="upload-person" label="Person" required hint={person ? `${person.company} · ${person.department}` : "The document is filed under their company and department."}>
            <Select id="upload-person" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Choose a person</option>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.code}){employee.former ? " · former" : ""}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
        <Field id="upload-type" label="Document type" required>
          <Select id="upload-type" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
            <option value="">Choose a type</option>
            {tree.types.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </Select>
        </Field>
        <Field id="upload-file" label="File" required hint="PDF, PNG, JPEG, WebP, Word, Excel or text; up to 10 MB.">
          <div
            className={cx(styles.drop, dragging && styles.dropActive, file && styles.dropFilled)}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
          >
            <FileUp size={22} aria-hidden="true" />
            {file ? <span className={styles.dropName}>{file.name} · {formatBytes(file.size)}</span> : <span>Drop a file here, or</span>}
            <Button size="sm" onClick={() => input.current?.click()}>{file ? "Choose another" : "Choose a file"}</Button>
            <input ref={input} id="upload-file" type="file" accept={ACCEPT} hidden onChange={(event) => choose(event.target.files?.[0] ?? null)} />
          </div>
        </Field>
        <Field id="upload-title" label="Title" required>
          <Input id="upload-title" value={titleTouched ? title : title || suggested} placeholder="For example: Passport – Ananya Iyer" maxLength={200} onChange={(event) => { setTitleTouched(true); setTitle(event.target.value); }} />
        </Field>
        <Field id="upload-number" label="Document number"><Input id="upload-number" value={number} maxLength={60} onChange={(event) => setNumber(event.target.value)} /></Field>
        <div className={styles.formRow}>
          <Field id="upload-issued" label="Issued on"><Input id="upload-issued" type="date" max={today} value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></Field>
          <Field id="upload-expires" label="Expires on" hint="Passports, visas and certificates: expiry warnings use this."><Input id="upload-expires" type="date" min={issuedOn || undefined} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></Field>
        </div>
      </div>
    </Drawer>
  );
}
