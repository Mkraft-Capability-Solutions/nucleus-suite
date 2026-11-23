import { NS, type Translate, type WorkerCategory } from "./api";

/** Client mirror of assignContractWorkerSchema (src/server/contractors/workforce.ts). The server stays authoritative. */

export type WorkerForm = {
  personName: string; agencyId: string; contractId: string; category: WorkerCategory; role: string; dailyWage: string;
  uan: string; esicNumber: string; aadhaar: string; locationId: string; startsOn: string;
};

export function validateWorker(t: Translate, form: WorkerForm): Partial<Record<keyof WorkerForm, string>> {
  const errors: Partial<Record<keyof WorkerForm, string>> = {};
  const name = form.personName.trim();
  if (name.length < 2 || name.length > 120) errors.personName = t(`${NS}.text_err_name`, "Enter the worker's full name.");
  if (!form.agencyId) errors.agencyId = t(`${NS}.text_err_agency`, "Choose the contractor agency.");
  if (!form.contractId) errors.contractId = t(`${NS}.text_err_contract`, "Choose the agency contract.");
  const role = form.role.trim();
  if (role.length < 2 || role.length > 80) errors.role = t(`${NS}.text_err_role`, "Enter the role or trade.");
  const wage = Number(form.dailyWage);
  if (form.dailyWage.trim() === "" || !Number.isFinite(wage) || wage <= 0 || wage > 100_000) errors.dailyWage = t(`${NS}.text_err_wage`, "Enter a daily wage greater than zero.");
  if (form.uan.trim() && !/^\d{12}$/.test(form.uan.trim())) errors.uan = t(`${NS}.text_err_uan`, "UAN must be 12 digits.");
  if (form.esicNumber.trim() && !/^\d{10,17}$/.test(form.esicNumber.trim())) errors.esicNumber = t(`${NS}.text_err_esic`, "ESIC number must be 10 to 17 digits.");
  if (form.aadhaar.trim() && !/^\d{12}$/.test(form.aadhaar.trim())) errors.aadhaar = t(`${NS}.text_err_aadhaar`, "Aadhaar must be 12 digits.");
  if (!form.locationId) errors.locationId = t(`${NS}.text_err_site`, "Choose the work site.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn)) errors.startsOn = t(`${NS}.text_err_start`, "Choose the assignment start date.");
  return errors;
}
