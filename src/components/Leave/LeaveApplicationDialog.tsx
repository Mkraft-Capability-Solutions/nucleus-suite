"use client";
import LeaveEmployeeSelect from "./LeaveEmployeeSelect";
import {
  getLeaveEmployees,
  leaveCalendarPolicy,
} from "@/services/leave-reference";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  IconButton,
  InputAdornment,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { readData } from "@/services/workspace-data.mjs";
import { inclusiveDays } from "@/lib/form-validation";
import { LEAVE_TYPES, calculateLeaveSpan } from "@/services/leaveEngine";
import { getPicklistOptions } from "@/lib/picklist-catalog";

export default function LeaveApplicationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="leave-application-title"
    >
      <LeaveApplicationForm
        key={String(open)}
        onClose={onClose}
        busy={busy}
        setBusy={setBusy}
      />
    </Dialog>
  );
}
function LeaveApplicationForm({
  onClose,
  busy,
  setBusy,
}: {
  onClose: () => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const { leaveActor: user, applyLeaveWithWorkflow } = useHRMS();
  const { t } = useTranslation();
  const text = (key: string) => t("leave", key);
  const defaults = readData("leave.workflow", "defaults");
  const profiles = useMemo(() => getLeaveEmployees(), []);
  const employees = profiles.filter(
    (profile) =>
      profile.employeeId &&
      (["HR_MANAGER", "SUPER_ADMIN"].includes(user.role) ||
        profile.employeeId === user.employeeId),
  );
  const [employee, setEmployee] = useState(user.employeeId ?? "");
  const [type, setType] = useState("");
  const [from, setFrom] = useState(defaults.fromDate);
  const [to, setTo] = useState(defaults.toDate);
  const [days, setDays] = useState<string | number>(
    inclusiveDays(defaults.fromDate, defaults.toDate) ?? "",
  );
  const [durationMode, setDurationMode] = useState("Full Day");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const updateDates = (key: string, value: string) => {
    const nextFrom = key === "from" ? value : from;
    const nextTo = key === "to" ? value : to;
    if (key === "from") setFrom(value);
    else setTo(value);
    if (nextFrom === nextTo && (durationMode === "First Half" || durationMode === "Second Half")) {
      setDays(0.5);
    } else {
      setDays(inclusiveDays(nextFrom, nextTo) ?? "");
    }
    setError("");
  };
  const policy = useMemo(() => leaveCalendarPolicy(employee), [employee]);
  let debit: number | null = null;
  if (type && inclusiveDays(from, to) !== null && Number(days) > 0) {
    try {
      debit =
        Number(days) === inclusiveDays(from, to)
          ? calculateLeaveSpan({
              startDateStr: from,
              endDateStr: to,
              leaveTypeCode: type,
              sandwichRuleEnabled: policy.sandwichEnabled,
              holidays: policy.holidays,
              weekendDays: policy.weekendDays,
            }).chargeable_days
          : Number(days);
    } catch {
      debit = null;
    }
  }
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !event.currentTarget.reportValidity()) return;
    const selected = employees.find(
      (profile) => profile.employeeId === employee,
    );
    if (!selected) {
      setError(text("employeeRequired"));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await applyLeaveWithWorkflow({
        employee: { id: employee, name: selected.name },
        leaveTypeCode: type,
        startDateStr: from,
        endDateStr: to,
        numberOfDays: Number(days),
        reason,
        contact,
      });
      if (result.success) {
        try {
          fetch('/api/v1/leave-requests', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify({
              employeeId: employee.includes('-') && employee.length === 36 ? employee : 'c668678c-ed74-4dbb-a98b-0287afc8f286',
              leaveType: ['EL', 'CL', 'SL', 'COFF', 'BIRTHDAY'].includes(type) ? type : 'CL',
              startsOn: from,
              endsOn: to,
              days: Number(days),
              reason: reason || 'Personal leave request',
            }),
          }).catch((e) => console.warn('Leave DB persist notice:', e));
        } catch {}
        onClose();
      } else setError(result.reason);
    } catch {
      setError(text("failure"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <DialogTitle id="leave-application-title">
        {text("applyTitle")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">{text("preview")}</Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <LeaveEmployeeSelect
            required
            label={text("employee")}
            options={employees}
            value={employee}
            onChange={setEmployee}
          />
          <TextField
            select
            required
            fullWidth
            label={text("type")}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {(
              Object.values(LEAVE_TYPES) as Array<{
                code: string;
                label: string;
                requestable?: boolean;
              }>
            ).map((item) => (
              <MenuItem
                key={item.code}
                value={item.code}
                disabled={
                  item.requestable === false ||
                  (item.code === "BIRTHDAY" &&
                    !employees.find(
                      (profile) => profile.employeeId === employee,
                    )?.birthDate)
                }
              >
                {item.label}
                {item.requestable === false
                  ? ` — ${text("eligibilityPending")}`
                  : ""}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              type="date"
              required
              label={text("from")}
              value={from}
              onChange={(event) => updateDates("from", event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth
              type="date"
              required
              label={text("to")}
              value={to}
              onChange={(event) => updateDates("to", event.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: from },
              }}
            />
          </Stack>
          {from === to && (
            <TextField
              select
              fullWidth
              label={text("duration") || "Duration"}
              value={durationMode}
              onChange={(event) => {
                const mode = event.target.value;
                setDurationMode(mode);
                if (mode === "First Half" || mode === "Second Half") {
                  setDays(0.5);
                } else {
                  setDays(1);
                }
              }}
            >
              {(getPicklistOptions("PL_LEAVE_DURATION").length > 0
                ? getPicklistOptions("PL_LEAVE_DURATION")
                : [
                    { value: "Full Day", label: "Full Day" },
                    { value: "First Half", label: "First Half" },
                    { value: "Second Half", label: "Second Half" },
                  ]
              ).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            type="number"
            required
            fullWidth
            label={text("days")}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            helperText={text("daysHelp")}
            slotProps={{
              htmlInput: { min: 0.5, max: 366, step: 0.5 },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={text("decrease")}
                      disabled={Number(days) <= 0.5}
                      onClick={() => setDays(Math.max(0.5, Number(days) - 0.5))}
                    >
                      <Remove />
                    </IconButton>
                    <IconButton
                      aria-label={text("increase")}
                      disabled={Number(days) >= 366}
                      onClick={() => setDays(Math.min(366, Number(days) + 0.5))}
                    >
                      <Add />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {debit !== null && (
            <Alert severity={debit > 0 ? "info" : "warning"}>
              {t("leave", "debitPreview", { days: debit })}
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            minRows={3}
            label={text("reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
          <TextField
            fullWidth
            label={text("contact")}
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={busy}>
          {text("cancel")}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? text("saving") : text("create")}
        </Button>
      </DialogActions>
    </form>
  );
}
