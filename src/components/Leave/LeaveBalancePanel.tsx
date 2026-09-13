"use client";
import LeaveEmployeeSelect from "./LeaveEmployeeSelect";
import { getLeaveEmployees } from "@/services/leave-reference";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { readData } from "@/services/workspace-data.mjs";
import { LEAVE_TYPES, evaluateCompOffValidity } from "@/services/leaveEngine";
import type { LeaveRequest } from "@/services/leave-workflow";
const keys: Record<string, string> = {
  privilege: "PRIVILEGE",
  sick: "SICK",
  casual: "CASUAL",
  wellness: "WELLNESS",
  comp_off: "COMP_OFF",
  birthday: "BIRTHDAY",
};
export default function LeaveBalancePanel() {
  const { leaveActor: user, leaveState, adjustLeaveAllocation } = useHRMS();
  const { t } = useTranslation();
  const text = (key: string) => t("leave", key);
  const admin = ["HR_MANAGER", "SUPER_ADMIN"].includes(user.role);
  const profiles = useMemo(
    () =>
      getLeaveEmployees().filter(
        (p) => p.employeeId && (admin || p.employeeId === user.employeeId),
      ),
    [admin, user.employeeId],
  );
  const [employee, setEmployee] = useState(
    user.employeeId ?? profiles[0]?.employeeId ?? "",
  );
  const [open, setOpen] = useState(false),
    [code, setCode] = useState(""),
    [days, setDays] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const accounts = leaveState.balances[employee] ?? {};
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current || !event.currentTarget.reportValidity()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await adjustLeaveAllocation({
        employeeId: employee,
        code,
        days: Number(days),
        reason,
      });
      if (result.success) {
        setOpen(false);
        setDays("");
        setReason("");
      } else setError(result.reason);
    } catch {
      setError(text("failure"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Stack component="section" aria-label={text("balanceSummary")} spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          {text("balanceSummary")}
        </Typography>
        <LeaveEmployeeSelect
          label={text("scope")}
          options={profiles}
          value={employee}
          onChange={setEmployee}
        />
        {admin && (
          <Button
            disabled={!employee}
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            {text("allocation")}
          </Button>
        )}
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={2}>
        {Object.entries(accounts).map(([key, value]) => {
          const stored = value as { available: number; total: number };
          const credits =
            key === "comp_off"
              ? evaluateCompOffValidity(
                  leaveState.credits.filter(
                    (credit: { employee_id: string }) =>
                      credit.employee_id === employee,
                  ),
                )
              : null;
          const account = credits
            ? { ...stored, available: credits.active_balance }
            : stored;
          const requests = (leaveState.requests as LeaveRequest[]).filter(
            (app) =>
              app.employee_id === employee && app.leave_type_code === keys[key],
          );
          return (
            <Card variant="outlined" key={key} sx={{ flex: "1 1 180px" }}>
              <CardContent>
                <Typography>{LEAVE_TYPES[keys[key]]?.label}</Typography>
                <Typography variant="h5">{account.available}</Typography>
                <Typography variant="body2">
                  {text("available")} / {text("allocated")}: {account.total}
                </Typography>
                <Typography variant="body2">
                  {text("pending")}:{" "}
                  {requests
                    .filter((app) => app.status.startsWith("PENDING_"))
                    .reduce((sum, app) => sum + app.chargeable_days, 0)}
                </Typography>
                {credits && (
                  <details>
                    <summary>{text("creditHistory")}</summary>
                    {credits.credits.map((credit) => (
                      <Typography
                        variant="caption"
                        display="block"
                        key={credit.id}
                      >
                        {credit.credited_at} → {credit.expires_at} ·{" "}
                        {credit.remaining_days} · {text(credit.status)}
                      </Typography>
                    ))}
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
      {Object.keys(accounts).length === 0 && (
        <Alert severity="info">{text("noAllocation")}</Alert>
      )}
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="leave-allocation-title"
      >
        <form onSubmit={submit}>
          <DialogTitle id="leave-allocation-title">
            {text("allocation")}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                select
                required
                label={text("type")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              >
                {(
                  Object.values(LEAVE_TYPES) as Array<{
                    code: string;
                    label: string;
                    requestable?: boolean;
                  }>
                )
                  .filter(
                    (item) =>
                      item.requestable !== false &&
                      !["LOP", "COMP_OFF"].includes(item.code),
                  )
                  .map((item) => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.label}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                required
                type="number"
                label={text("adjustmentDays")}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                slotProps={{ htmlInput: { min: -366, max: 366, step: 0.5 } }}
              />
              <TextField
                required
                multiline
                minRows={3}
                label={text("adjustmentReason")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setOpen(false)}>
              {text("cancel")}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {text("confirm")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
