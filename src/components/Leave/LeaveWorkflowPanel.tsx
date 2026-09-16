"use client";
import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { canReviewLeave, type LeaveRequest } from "@/app/actions/leaveActions";
import LeaveBalancePanel from "./LeaveBalancePanel";
import LeaveCalendar from "./LeaveCalendar";
import { csvRows } from "@/utils/csv";
import LeaveApplicationDialog from "./LeaveApplicationDialog";

export default function LeaveWorkflowPanel() {
  const {
    leaveApplications,
    advanceLeaveApproval,
    leaveActor: user,
    leaveState,
  } = useHRMS();
  const { t } = useTranslation();
  const text = (key: string) => t("leave", key);
  const [view, setView] = useState("list");
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const [decision, setDecision] = useState<{
    app: LeaveRequest;
    action: string;
  } | null>(null);
  const [remarks, setRemarks] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requests = (leaveApplications as LeaveRequest[]).filter((app) =>
    `${app.employee_name} ${app.leave_type_label} ${app.status} ${app.start_date}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const choose = (app: LeaveRequest, action: string) => {
    setDecision({ app, action });
    setRemarks("");
    setError("");
  };
  const confirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision || lock.current || !event.currentTarget.reportValidity())
      return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await advanceLeaveApproval({
        applicationId: decision.app.id,
        action: decision.action,
        remarks,
        expectedVersion: decision.app.version,
      });
      if (result.success) setDecision(null);
      else setError(result.reason);
    } catch {
      setError(text("failure"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const exportReport = () => {
    const content = csvRows([
      [
        text("employee"),
        text("type"),
        text("from"),
        text("to"),
        text("days"),
        text("view"),
      ],
      ...requests.map((app) => [
        app.employee_name,
        app.leave_type_label,
        app.start_date,
        app.end_date,
        app.chargeable_days,
        text(app.status),
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "nucleus-leave-preview.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Stack spacing={2}>
      <Alert severity="info">{text("preview")}</Alert>
      <LeaveBalancePanel />
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={2}
        justifyContent="space-between"
      >
        <ToggleButtonGroup
          exclusive
          value={view}
          onChange={(_, value) => {
            if (value) setView(value);
          }}
          aria-label={text("view")}
        >
          <ToggleButton value="list">{text("list")}</ToggleButton>
          <ToggleButton value="calendar">{text("calendar")}</ToggleButton>
        </ToggleButtonGroup>
        <Button onClick={exportReport}>{text("export")}</Button>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label={text("search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          {text("apply")}
        </Button>
      </Stack>
      {view === "calendar" && <LeaveCalendar requests={requests} />}
      {view === "list" && requests.length === 0 && (
        <Alert severity="info">{text("empty")}</Alert>
      )}
      {view === "list" &&
        requests.map((app) => (
          <Card key={app.id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="h6">{app.employee_name}</Typography>
                <Chip label={text(app.status)} />
              </Stack>
              <Typography>{app.leave_type_label}</Typography>
              <Typography color="text.secondary">
                {app.start_date} — {app.end_date} ·{" "}
                {t("leave", "debit", { days: app.chargeable_days })}
              </Typography>
              {app.reason && (
                <Typography sx={{ overflowWrap: "anywhere", my: 1 }}>
                  {app.reason}
                </Typography>
              )}
              {(app.reference_only ||
                !leaveState.balances[app.employee_id]) && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {text("legacyAccount")}
                </Alert>
              )}
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
                {!app.reference_only &&
                  Boolean(leaveState.balances[app.employee_id]) &&
                  app.status.startsWith("PENDING_") &&
                  canReviewLeave(user, app) && (
                    <>
                      <Button onClick={() => choose(app, "APPROVE")}>
                        {text("approve")}
                      </Button>
                      <Button
                        color="error"
                        onClick={() => choose(app, "REJECT")}
                      >
                        {text("reject")}
                      </Button>
                    </>
                  )}
                {!app.reference_only &&
                  Boolean(leaveState.balances[app.employee_id]) &&
                  (user.employeeId === app.employee_id ||
                    ["HR_MANAGER", "SUPER_ADMIN"].includes(user.role)) && (
                    <>
                      {app.status.startsWith("PENDING_") && (
                        <Button onClick={() => choose(app, "WITHDRAW")}>
                          {text("withdraw")}
                        </Button>
                      )}
                      {app.status === "APPROVED" && (
                        <Button onClick={() => choose(app, "CANCEL")}>
                          {text("cancelRequest")}
                        </Button>
                      )}
                    </>
                  )}
              </Stack>
              <Box component="details" sx={{ mt: 2 }}>
                <summary>{text("history")}</summary>
                {!leaveState.events.some(
                  (entry: { requestId: string }) => entry.requestId === app.id,
                ) &&
                  app.approval_history?.map((entry, index) => (
                    <Typography
                      key={`${entry.timestamp}-${index}`}
                      variant="body2"
                    >
                      {entry.timestamp} · {entry.reviewer} ·{" "}
                      {text(entry.action)} {entry.remarks}
                    </Typography>
                  ))}
                {leaveState.events
                  .filter(
                    (entry: { requestId: string }) =>
                      entry.requestId === app.id,
                  )
                  .map(
                    (entry: {
                      id: string;
                      at: string;
                      actor: string;
                      action: string;
                    }) => (
                      <Typography key={entry.id} variant="body2">
                        {entry.at} · {entry.actor} · {text(entry.action)}
                      </Typography>
                    ),
                  )}
              </Box>
            </CardContent>
          </Card>
        ))}
      <Box component="details">
        <summary>{text("notifications")}</summary>
        {leaveState.events
          .filter(
            (entry: { requestId: string }) =>
              leaveApplications.some(
                (app: LeaveRequest) => app.id === entry.requestId,
              ) ||
              entry.requestId.startsWith(`balance:${user.employeeId}:`) ||
              ["HR_MANAGER", "SUPER_ADMIN"].includes(user.role),
          )
          .map(
            (entry: {
              id: string;
              at: string;
              action: string;
              remarks: string;
            }) => (
              <Typography key={entry.id} variant="body2">
                {entry.at} · {text(entry.action)} · {entry.remarks}
              </Typography>
            ),
          )}
      </Box>
      <LeaveApplicationDialog open={open} onClose={() => setOpen(false)} />
      <Dialog
        open={Boolean(decision)}
        onClose={() => {
          if (!busy) setDecision(null);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="leave-decision-title"
      >
        <form onSubmit={confirm}>
          <DialogTitle id="leave-decision-title">
            {text(decision?.action ?? "review")}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography>
                {decision?.app.employee_name} · {decision?.app.start_date}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={3}
                required={decision?.action === "REJECT"}
                label={text("comments")}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setDecision(null)}>
              {text("cancel")}
            </Button>
            <Button
              disabled={busy}
              aria-busy={busy}
              type="submit"
              variant="contained"
            >
              {text("confirm")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
