"use client";
import { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import {
  getLeaveEmployees,
  leaveCalendarPolicy,
} from "@/app/actions/leaveActions";
import LeaveEmployeeSelect from "./LeaveEmployeeSelect";
import type { LeaveRequest } from "@/app/actions/leaveActions";
export default function LeaveCalendar({
  requests,
}: {
  requests: LeaveRequest[];
}) {
  const { leaveApplications, leaveActor } = useHRMS();
  const [employee, setEmployee] = useState(leaveActor.employeeId ?? "");
  const ids = (leaveApplications as LeaveRequest[]).map(
    (app) => app.employee_id,
  );
  const employees = getLeaveEmployees().filter(
    (item) =>
      ids.includes(item.employeeId) ||
      item.employeeId === leaveActor.employeeId,
  );
  const { t, locale } = useTranslation();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const valid =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900;
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const count = valid ? new Date(Date.UTC(year, m, 0)).getUTCDate() : 0;
  const policy = useMemo(() => leaveCalendarPolicy(employee), [employee]);
  return (
    <Stack spacing={2}>
      <LeaveEmployeeSelect
        label={t("leave", "calendarScope")}
        options={employees}
        value={employee}
        onChange={setEmployee}
      />
      <TextField
        required
        error={!valid}
        helperText={!valid ? t("leave", "selectMonth") : undefined}
        type="month"
        label={t("leave", "month")}
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: "1900-01", max: "9999-12" },
        }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: 1.5,
        }}
      >
        {Array.from({ length: count }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`;
          const day = new Date(`${date}T00:00:00Z`);
          const holiday = policy.holidays.includes(date),
            weekend = policy.weekendDays.includes(day.getUTCDay());
          const matching = requests.filter(
            (app) =>
              (!employee || app.employee_id === employee) &&
              !["REJECTED", "CANCELLED", "WITHDRAWN"].includes(app.status) &&
              app.start_date <= date &&
              String(app.adjusted_end_date ?? app.end_date) >= date,
          );
          return (
            <Card variant="outlined" key={date}>
              <CardContent>
                <Typography component="h3" variant="subtitle2">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(day)}
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {holiday && (
                    <Chip size="small" label={t("leave", "holiday")} />
                  )}{" "}
                  {weekend && (
                    <Chip size="small" label={t("leave", "weekend")} />
                  )}{" "}
                  {matching.map((app) => (
                    <Box key={app.id}>
                      <Typography variant="body2">
                        {app.employee_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("leave", app.status)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Stack>
  );
}
