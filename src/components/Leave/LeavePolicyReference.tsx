"use client";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { readData } from "@/services/workspace-data.mjs";
import { useTranslation } from "@/context/I18nContext";
export default function LeavePolicyReference() {
  const { t } = useTranslation();
  const text = (key: string) => t("leave", key);
  const workbook = readData("workbook");
  const types = workbook.sheets["14_Leave_Types"].filter(
    (row: Record<string, string>) => /^[A-Z]{2,6}$/.test(row["Leave type"]),
  );
  const policies = workbook.sheets["15_Leave_Accrual_Policy"].filter(
    (row: Record<string, string>) => /^LP-/.test(row["Policy code"]),
  );
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{text("policyTitle")}</Typography>
      <Alert severity="info">{text("policyNotice")}</Alert>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 2,
        }}
      >
        {types.map((row: Record<string, string>) => (
          <Card key={row["Leave type"]} variant="outlined">
            <CardContent>
              <Typography variant="h6">{row.Name}</Typography>
              <Typography variant="body2">
                {text("policyAccrual")}: {row.Accrual}
              </Typography>
              <Typography variant="body2">
                {text("policyCarry")}: {row["Carry forward"]}
              </Typography>
              <Typography variant="body2">
                {text("policyMonthly")}:{" "}
                {row["Max per month"] ?? text("notSpecified")}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Typography variant="h6">{text("policyAccrual")}</Typography>
      {policies.map((row: Record<string, string>) => (
        <Card variant="outlined" key={row["Policy code"]}>
          <CardContent>
            <Typography variant="subtitle1">
              {row["Policy code"]} · {row["Leave band"]} · {row["Leave type"]}
            </Typography>
            <Typography variant="body2">
              {text("policyAnnual")}: {row["Annual days"]} ·{" "}
              {text("policyWait")}: {row["Eligibility wait (months)"]} ·{" "}
              {text("policyCredit")}:{" "}
              {row["Credit on completion"] ?? text("notSpecified")}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
