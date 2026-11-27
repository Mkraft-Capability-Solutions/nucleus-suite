<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-TIM-11 — Time & Attendance — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-TIM-11 |
| Title | Time & Attendance — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Time & Attendance |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-TIM-00, FRS-TIM-01, FRS-TIM-02, FRS-TIM-03, FRS-TIM-04, FRS-TIM-05, FRS-TIM-06, FRS-TIM-07, FRS-TIM-08, FRS-TIM-09, FRS-TIM-10, FRS-TIM-11, FRS-TIM-12, FRS-TIM-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-03 · R-01, R-02, R-11, R-12, R-13, R-14 · processes TIM-01–TIM-10 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 07_Shifts, 08_Attendance_Rules, 20_Punch_Events, 21_Expected_Attendance, 22_Gate_Pass, 23_Overtime_Register, 41_Grace_Late_Policy, 42_Night_Extension_Rule, 49_Break_Register, 50_Attendance_Regularisation, 51_Attendance_Exceptions, 52_Shift_Roster |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Rostered shift | ATT | F-ATT-01 — Daily Attendance Processing | From the shift roster | All roles | R-14 | Yes |
| Break type | ATT | F-ATT-03 — Break Register | Unclassified | All roles | R-01 | Yes — value set configurable per tenant |
| Include indirect reportees | ATT | F-ATT-05 — Team Calendar | N | Reporting manager and above | R-02 | Yes |
| Grace minutes on arrival | ATT | F-ATT-06 — Grace & Late Policy Setup | 15 | HR roles only | R-13 | Yes — default 15 per the stated policy |
| Grace minutes on departure | ATT | F-ATT-06 — Grace & Late Policy Setup | 15 | HR roles only | R-13 | Yes — default 15 per the stated policy |
| Lates allowed per month | ATT | F-ATT-06 — Grace & Late Policy Setup | 3 | HR roles only | R-13 | Yes — default 3 per the stated policy |
| Consequence beyond the allowance | ATT | F-ATT-06 — Grace & Late Policy Setup | Half day | HR roles only | R-13 | Yes — value set configurable per tenant |
| Counter reset basis | ATT | F-ATT-06 — Grace & Late Policy Setup | Calendar month | HR roles only | R-13 | Yes — value set configurable per tenant |
| Exempt from grade rank | ATT | F-ATT-06 — Grace & Late Policy Setup | Assistant Manager rank | HR roles only | R-13 | Yes |
| Shift code | SHF | F-SHF-01 — Shift Master | — | All roles | R-13, R-14 | Yes |
| Shift start time | SHF | F-SHF-01 — Shift Master | — | All roles | R-13 | Yes |
| Shift end time | SHF | F-SHF-01 — Shift Master | — | All roles | R-13 | Yes |
| Half day threshold hours | SHF | F-SHF-01 — Shift Master | Per the shift length | All roles | R-13 | Yes — configuration, not code |
| Absent threshold hours | SHF | F-SHF-01 — Shift Master | Per the shift length | All roles | R-13 | Yes — configuration, not code |
| Detection window from | SHF | F-SHF-01 — Shift Master | — | All roles | R-14 | Yes |
| Detection window to | SHF | F-SHF-01 — Shift Master | — | All roles | R-14 | Yes |
| Auto detect enabled | SHF | F-SHF-01 — Shift Master | Y | All roles | R-14 | Yes |
| OT starts after hours | SHF | F-SHF-01 — Shift Master | Shift duration | All roles | R-01 | Yes |
| Applies to shift | SHF | F-SHF-03 — Night Extension Rule Setup | — | HR roles only | R-13 | Yes |
| Triggered when previous session ends after | SHF | F-SHF-03 — Night Extension Rule Setup | 03:00 | HR roles only | R-13 | Yes |
| Permitted late arrival until | SHF | F-SHF-03 — Night Extension Rule Setup | 09:30 | HR roles only | R-13 | Yes |
| Minimum departure time to qualify | SHF | F-SHF-03 — Night Extension Rule Setup | 20:00 | HR roles only | R-13 | Yes |
| Day status when the rule applies | SHF | F-SHF-03 — Night Extension Rule Setup | Present | HR roles only | R-13 | Yes — value set configurable per tenant |
| Maximum uses per month | SHF | F-SHF-03 — Night Extension Rule Setup | — | HR roles only | R-13 | Yes |
| OT basis hours | OTM | F-OTM-01 — OT Computation & Approval | Gross work hours | All roles | R-01 | Yes |
| OT period from | OTM | F-OTM-02 — OT Payment Run | — | Payroll and HR roles only | R-11 | Yes |
| OT period to | OTM | F-OTM-02 — OT Payment Run | — | Payroll and HR roles only | R-11 | Yes |
| Gate pass type | GPS | F-GPS-01 — Gate Pass Request | Personal | All roles | R-12 | Yes — value set configurable per tenant |
| Credit to work hours on approval | GPS | F-GPS-01 — Gate Pass Request | Y | All roles | R-12 | Yes |

## 2. Reference and golden data

### `07_Shifts` (7 rows)

| Shift code | Shift name | Shift group | Start | End | Duration (min) | Break — recorded, paid (min) | Break — deducted (min) | Inference window — earliest in | Inference window — latest in | Crosses midnight | Half day if net below (min) | Absent if net below (min) | OT starts after (min) | Auto detect enabled | Thresholds source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SH-A | A Shift — Day 12h | PLANT12 | 08:00 | 20:00 | 720 | 60 | 0 | 06:30 | 09:29 | N | 690 | 390 | 720 | Y | Mirrors 08_Attendance_Rules for this shift length. F-SHF-01 requires the thresholds to live on the shift, not in code. |
| SH-B | B Shift — Night 12h | PLANT12 | 20:00 | 08:00 | 720 | 60 | 0 | 19:00 | 22:29 | Y | 690 | 390 | 720 | Y | Mirrors 08_Attendance_Rules for this shift length. F-SHF-01 requires the thresholds to live on the shift, not in code. |
| SH-C | C Shift — Early 10h | PLANT10 | 07:00 | 17:00 | 600 | 45 | 0 | 05:30 | 07:59 | N | 570 | 360 | 600 | Y | Mirrors 08_Attendance_Rules for this shift length. F-SHF-01 requires the thresholds to live on the shift, not in code. |
| SH-D | D Shift — Late 10h | PLANT10 | 17:00 | 03:00 | 600 | 45 | 0 | 16:00 | 18:29 | Y | 570 | 360 | 600 | Y | Mirrors 08_Attendance_Rules for this shift length. F-SHF-01 requires the thresholds to live on the shift, not in code. |
| SH-E | General Shift 9h | STAFF9 | 09:00 | 18:00 | 540 | 45 | 0 | 07:30 | 11:00 | N | 510 | 300 | 540 | Y | Mirrors 08_Attendance_Rules for this shift length. F-SHF-01 requires the thresholds to live on the shift, not in code. |
| SH-F | Office Shift 8h | OFFICE8 | 09:30 | 17:30 | 480 | 30 | 0 | 08:00 | 11:30 | N | 450 | 270 | 480 | N | Mirrors 08_Attendance_Rules for this shift length. F-SHF-01 requires the thresholds to live on the shift, not in code. |
| Breaks are recorded and reported but NOT deducted for this client — see sheet 21. Inference windows do not overlap inside a shift group. An in-punch inside another shift's window within the same group causes that shift to be adopted for the day (demo point 13). ADDED v1.1: half-day, absent and OT thresholds now sit on the shift itself, as F-SHF-01 requires. They are the same numbers as 08_Attendance_Rules — if the two ever disagree, the shift master wins and 08 is the audit copy. SH-F is office staff and auto-detection is off for it. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `08_Attendance_Rules` (5 rows)

| Shift hours | Half day if net below (min) | Absent if net below (min) | Grace in (min) | Grace out (min) | Late instances allowed per month | Long night finishes after | Next-day relief until | Stated as |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 12 | 690 | 390 | 15 | 15 | 3 | 03:00 | 09:30 | 11:30 net for half day, 6:30 for absent |
| 10 | 570 | 360 | 15 | 15 | 3 | 03:00 | 09:30 | 9:30 net for half day, 6:00 for absent |
| 9 | 510 | 300 | 15 | 15 | 3 | 03:00 | 09:30 | 8:30 net for half day, 5:00 for absent |
| 8 | 450 | 270 | 15 | 15 | 3 | 03:00 | 09:30 | 7:30 net for half day, 4:30 for absent |
| These four rows are the client's stated rule. Sheet 21 reads them by INDEX/MATCH, so changing a threshold here updates every expected status. Overtime basis for this client is the GROSS span, not net hours — see 21_Expected_Attendance. |  |  |  |  |  |  |  |  |

### `20_Punch_Events` (397 rows)

| Event ID | Employee code | Name | Attendance date | Segment | Direction | Time | Calendar date of punch | Source | Device | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PE-00001 | E1018 | Ravi Kulkarni | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00002 | E1018 | Ravi Kulkarni | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00003 | E1018 | Ravi Kulkarni | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00004 | E1018 | Ravi Kulkarni | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00005 | E1018 | Ravi Kulkarni | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00006 | E1018 | Ravi Kulkarni | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00007 | E1018 | Ravi Kulkarni | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00008 | E1018 | Ravi Kulkarni | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00009 | E1018 | Ravi Kulkarni | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00010 | E1018 | Ravi Kulkarni | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00011 | E1018 | Ravi Kulkarni | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00012 | E1018 | Ravi Kulkarni | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00013 | E1018 | Ravi Kulkarni | 2026-09-08 | 1 | IN | 08:00 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00014 | E1018 | Ravi Kulkarni | 2026-09-08 | 1 | OUT | 20:30 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00015 | E1018 | Ravi Kulkarni | 2026-09-08 | 2 | IN | 21:15 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00016 | E1018 | Ravi Kulkarni | 2026-09-08 | 2 | OUT | 03:20 | 2026-09-09 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00017 | E1018 | Ravi Kulkarni | 2026-09-09 | 1 | IN | 09:25 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00018 | E1018 | Ravi Kulkarni | 2026-09-09 | 1 | OUT | 20:10 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00019 | E1018 | Ravi Kulkarni | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00020 | E1018 | Ravi Kulkarni | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00021 | E1018 | Ravi Kulkarni | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00022 | E1018 | Ravi Kulkarni | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00023 | E1018 | Ravi Kulkarni | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00024 | E1018 | Ravi Kulkarni | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00025 | E1018 | Ravi Kulkarni | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00026 | E1018 | Ravi Kulkarni | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00027 | E1018 | Ravi Kulkarni | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00028 | E1018 | Ravi Kulkarni | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00029 | E1019 | Sneha Nair | 2026-09-01 | 1 | IN | 08:22 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00030 | E1019 | Sneha Nair | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00031 | E1019 | Sneha Nair | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00032 | E1019 | Sneha Nair | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00033 | E1019 | Sneha Nair | 2026-09-03 | 1 | IN | 08:31 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00034 | E1019 | Sneha Nair | 2026-09-03 | 1 | OUT | 20:11 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00035 | E1019 | Sneha Nair | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00036 | E1019 | Sneha Nair | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00037 | E1019 | Sneha Nair | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00038 | E1019 | Sneha Nair | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00039 | E1019 | Sneha Nair | 2026-09-07 | 1 | IN | 08:19 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00040 | E1019 | Sneha Nair | 2026-09-07 | 1 | OUT | 20:03 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00041 | E1019 | Sneha Nair | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00042 | E1019 | Sneha Nair | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00043 | E1019 | Sneha Nair | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00044 | E1019 | Sneha Nair | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00045 | E1019 | Sneha Nair | 2026-09-10 | 1 | IN | 08:27 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00046 | E1019 | Sneha Nair | 2026-09-10 | 1 | OUT | 20:09 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00047 | E1019 | Sneha Nair | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00048 | E1019 | Sneha Nair | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00049 | E1019 | Sneha Nair | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00050 | E1019 | Sneha Nair | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00051 | E1019 | Sneha Nair | 2026-09-14 | 1 | IN | 08:24 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00052 | E1019 | Sneha Nair | 2026-09-14 | 1 | OUT | 20:14 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00053 | E1019 | Sneha Nair | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00054 | E1019 | Sneha Nair | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00055 | E1020 | Arjun Bhat | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00056 | E1020 | Arjun Bhat | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00057 | E1020 | Arjun Bhat | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00058 | E1020 | Arjun Bhat | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00059 | E1020 | Arjun Bhat | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00060 | E1020 | Arjun Bhat | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00061 | E1020 | Arjun Bhat | 2026-09-04 | 1 | IN | 20:05 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00062 | E1020 | Arjun Bhat | 2026-09-04 | 1 | OUT | 08:40 | 2026-09-05 | Biometric | BIO-PLA-01 | Next calendar day |
| PE-00063 | E1020 | Arjun Bhat | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00064 | E1020 | Arjun Bhat | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00065 | E1020 | Arjun Bhat | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00066 | E1020 | Arjun Bhat | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00067 | E1020 | Arjun Bhat | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00068 | E1020 | Arjun Bhat | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00069 | E1020 | Arjun Bhat | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00070 | E1020 | Arjun Bhat | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00071 | E1020 | Arjun Bhat | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00072 | E1020 | Arjun Bhat | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00073 | E1020 | Arjun Bhat | 2026-09-11 | 1 | IN | 19:58 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00074 | E1020 | Arjun Bhat | 2026-09-11 | 1 | OUT | 08:36 | 2026-09-12 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00075 | E1020 | Arjun Bhat | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00076 | E1020 | Arjun Bhat | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00077 | E1020 | Arjun Bhat | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00078 | E1020 | Arjun Bhat | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00079 | E1020 | Arjun Bhat | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00080 | E1020 | Arjun Bhat | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00081 | E1022 | Mohan Joseph | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00082 | E1022 | Mohan Joseph | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00083 | E1022 | Mohan Joseph | 2026-09-02 | 1 | IN | 08:05 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00084 | E1022 | Mohan Joseph | 2026-09-02 | 1 | OUT | 18:30 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00085 | E1022 | Mohan Joseph | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00086 | E1022 | Mohan Joseph | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00087 | E1022 | Mohan Joseph | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00088 | E1022 | Mohan Joseph | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00089 | E1022 | Mohan Joseph | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00090 | E1022 | Mohan Joseph | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00091 | E1022 | Mohan Joseph | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00092 | E1022 | Mohan Joseph | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00093 | E1022 | Mohan Joseph | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00094 | E1022 | Mohan Joseph | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00095 | E1022 | Mohan Joseph | 2026-09-09 | 1 | IN | 08:10 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00096 | E1022 | Mohan Joseph | 2026-09-09 | 1 | OUT | 13:15 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00097 | E1022 | Mohan Joseph | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00098 | E1022 | Mohan Joseph | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00099 | E1022 | Mohan Joseph | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00100 | E1022 | Mohan Joseph | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00101 | E1022 | Mohan Joseph | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00102 | E1022 | Mohan Joseph | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00103 | E1022 | Mohan Joseph | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00104 | E1022 | Mohan Joseph | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00105 | E1022 | Mohan Joseph | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00106 | E1022 | Mohan Joseph | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00107 | E1023 | Kavya Venkatesh | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00108 | E1023 | Kavya Venkatesh | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00109 | E1023 | Kavya Venkatesh | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00110 | E1023 | Kavya Venkatesh | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00111 | E1023 | Kavya Venkatesh | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00112 | E1023 | Kavya Venkatesh | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00113 | E1023 | Kavya Venkatesh | 2026-09-04 | 1 | IN | 08:02 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00114 | E1023 | Kavya Venkatesh | 2026-09-04 | 1 | OUT | 12:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00115 | E1023 | Kavya Venkatesh | 2026-09-04 | 2 | IN | 14:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00116 | E1023 | Kavya Venkatesh | 2026-09-04 | 2 | OUT | 20:04 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00117 | E1023 | Kavya Venkatesh | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00118 | E1023 | Kavya Venkatesh | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00119 | E1023 | Kavya Venkatesh | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00120 | E1023 | Kavya Venkatesh | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00121 | E1023 | Kavya Venkatesh | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00122 | E1023 | Kavya Venkatesh | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00123 | E1023 | Kavya Venkatesh | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00124 | E1023 | Kavya Venkatesh | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00125 | E1023 | Kavya Venkatesh | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00126 | E1023 | Kavya Venkatesh | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00127 | E1023 | Kavya Venkatesh | 2026-09-11 | 1 | IN | 08:06 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00128 | E1023 | Kavya Venkatesh | 2026-09-11 | 1 | OUT | 11:30 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00129 | E1023 | Kavya Venkatesh | 2026-09-11 | 2 | IN | 13:30 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00130 | E1023 | Kavya Venkatesh | 2026-09-11 | 2 | OUT | 20:08 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00131 | E1023 | Kavya Venkatesh | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00132 | E1023 | Kavya Venkatesh | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00133 | E1023 | Kavya Venkatesh | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00134 | E1023 | Kavya Venkatesh | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00135 | E1023 | Kavya Venkatesh | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00136 | E1023 | Kavya Venkatesh | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00137 | E1026 | Manjunath Poojary | 2026-09-01 | 1 | IN | 19:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00138 | E1026 | Manjunath Poojary | 2026-09-01 | 1 | OUT | 08:06 | 2026-09-02 | Biometric | BIO-PLA-01 | Next calendar day |
| PE-00139 | E1026 | Manjunath Poojary | 2026-09-02 | 1 | IN | 19:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00140 | E1026 | Manjunath Poojary | 2026-09-02 | 1 | OUT | 08:11 | 2026-09-03 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00141 | E1026 | Manjunath Poojary | 2026-09-03 | 1 | IN | 19:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00142 | E1026 | Manjunath Poojary | 2026-09-03 | 1 | OUT | 08:03 | 2026-09-04 | Biometric | BIO-PLA-03 | Next calendar day |
| PE-00143 | E1026 | Manjunath Poojary | 2026-09-04 | 1 | IN | 20:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00144 | E1026 | Manjunath Poojary | 2026-09-04 | 1 | OUT | 08:14 | 2026-09-05 | Biometric | BIO-PLA-01 | Next calendar day |
| PE-00145 | E1026 | Manjunath Poojary | 2026-09-05 | 1 | IN | 19:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00146 | E1026 | Manjunath Poojary | 2026-09-05 | 1 | OUT | 08:08 | 2026-09-06 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00147 | E1026 | Manjunath Poojary | 2026-09-07 | 1 | IN | 19:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00148 | E1026 | Manjunath Poojary | 2026-09-07 | 1 | OUT | 08:17 | 2026-09-08 | Biometric | BIO-PLA-01 | Next calendar day |
| PE-00149 | E1026 | Manjunath Poojary | 2026-09-08 | 1 | IN | 19:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00150 | E1026 | Manjunath Poojary | 2026-09-08 | 1 | OUT | 08:05 | 2026-09-09 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00151 | E1026 | Manjunath Poojary | 2026-09-09 | 1 | IN | 19:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00152 | E1026 | Manjunath Poojary | 2026-09-09 | 1 | OUT | 08:09 | 2026-09-10 | Biometric | BIO-PLA-03 | Next calendar day |
| PE-00153 | E1026 | Manjunath Poojary | 2026-09-10 | 1 | IN | 20:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00154 | E1026 | Manjunath Poojary | 2026-09-10 | 1 | OUT | 08:12 | 2026-09-11 | Biometric | BIO-PLA-01 | Next calendar day |
| PE-00155 | E1026 | Manjunath Poojary | 2026-09-11 | 1 | IN | 19:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00156 | E1026 | Manjunath Poojary | 2026-09-11 | 1 | OUT | 08:04 | 2026-09-12 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00157 | E1026 | Manjunath Poojary | 2026-09-12 | 1 | IN | 20:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00158 | E1026 | Manjunath Poojary | 2026-09-12 | 1 | OUT | 08:19 | 2026-09-13 | Biometric | BIO-PLA-03 | Next calendar day |
| PE-00159 | E1026 | Manjunath Poojary | 2026-09-14 | 1 | IN | 20:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00160 | E1026 | Manjunath Poojary | 2026-09-14 | 1 | OUT | 08:10 | 2026-09-15 | Biometric | BIO-PLA-02 | Next calendar day |
| PE-00161 | E1026 | Manjunath Poojary | 2026-09-15 | 1 | IN | 19:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00162 | E1026 | Manjunath Poojary | 2026-09-15 | 1 | OUT | 08:06 | 2026-09-16 | Biometric | BIO-PLA-03 | Next calendar day |
| PE-00163 | E1028 | Yashoda Rani | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00164 | E1028 | Yashoda Rani | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00165 | E1028 | Yashoda Rani | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00166 | E1028 | Yashoda Rani | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00167 | E1028 | Yashoda Rani | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00168 | E1028 | Yashoda Rani | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00169 | E1028 | Yashoda Rani | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00170 | E1028 | Yashoda Rani | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00171 | E1028 | Yashoda Rani | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00172 | E1028 | Yashoda Rani | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00173 | E1028 | Yashoda Rani | 2026-09-06 | 1 | IN | 08:04 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00174 | E1028 | Yashoda Rani | 2026-09-06 | 1 | OUT | 20:12 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00175 | E1028 | Yashoda Rani | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00176 | E1028 | Yashoda Rani | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00177 | E1028 | Yashoda Rani | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00178 | E1028 | Yashoda Rani | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00179 | E1028 | Yashoda Rani | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00180 | E1028 | Yashoda Rani | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00181 | E1028 | Yashoda Rani | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00182 | E1028 | Yashoda Rani | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00183 | E1028 | Yashoda Rani | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00184 | E1028 | Yashoda Rani | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00185 | E1028 | Yashoda Rani | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00186 | E1028 | Yashoda Rani | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00187 | E1028 | Yashoda Rani | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00188 | E1028 | Yashoda Rani | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00189 | E1028 | Yashoda Rani | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00190 | E1028 | Yashoda Rani | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00191 | E1032 | Shivanna Muniyappa | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00192 | E1032 | Shivanna Muniyappa | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00193 | E1032 | Shivanna Muniyappa | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00194 | E1032 | Shivanna Muniyappa | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00195 | E1032 | Shivanna Muniyappa | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00196 | E1032 | Shivanna Muniyappa | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00197 | E1032 | Shivanna Muniyappa | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00198 | E1032 | Shivanna Muniyappa | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00199 | E1032 | Shivanna Muniyappa | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00200 | E1032 | Shivanna Muniyappa | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00201 | E1032 | Shivanna Muniyappa | 2026-09-06 | 1 | IN | 08:03 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00202 | E1032 | Shivanna Muniyappa | 2026-09-06 | 1 | OUT | 20:02 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00203 | E1032 | Shivanna Muniyappa | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00204 | E1032 | Shivanna Muniyappa | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00205 | E1032 | Shivanna Muniyappa | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00206 | E1032 | Shivanna Muniyappa | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00207 | E1032 | Shivanna Muniyappa | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00208 | E1032 | Shivanna Muniyappa | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00209 | E1032 | Shivanna Muniyappa | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00210 | E1032 | Shivanna Muniyappa | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00211 | E1032 | Shivanna Muniyappa | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00212 | E1032 | Shivanna Muniyappa | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00213 | E1032 | Shivanna Muniyappa | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00214 | E1032 | Shivanna Muniyappa | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00215 | E1032 | Shivanna Muniyappa | 2026-09-13 | 1 | IN | 07:55 | 2026-09-13 | Biometric | BIO-PLA-01 |  |
| PE-00216 | E1032 | Shivanna Muniyappa | 2026-09-13 | 1 | OUT | 20:07 | 2026-09-13 | Biometric | BIO-PLA-01 |  |
| PE-00217 | E1032 | Shivanna Muniyappa | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00218 | E1032 | Shivanna Muniyappa | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00219 | E1032 | Shivanna Muniyappa | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00220 | E1032 | Shivanna Muniyappa | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00221 | E1034 | Imran Shaikh | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00222 | E1034 | Imran Shaikh | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00223 | E1034 | Imran Shaikh | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00224 | E1034 | Imran Shaikh | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00225 | E1034 | Imran Shaikh | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00226 | E1034 | Imran Shaikh | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00227 | E1034 | Imran Shaikh | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00228 | E1034 | Imran Shaikh | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00229 | E1034 | Imran Shaikh | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00230 | E1034 | Imran Shaikh | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00231 | E1034 | Imran Shaikh | 2026-09-06 | 1 | IN | 08:03 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00232 | E1034 | Imran Shaikh | 2026-09-06 | 1 | OUT | 20:11 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00233 | E1034 | Imran Shaikh | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00234 | E1034 | Imran Shaikh | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00235 | E1034 | Imran Shaikh | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00236 | E1034 | Imran Shaikh | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00237 | E1034 | Imran Shaikh | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00238 | E1034 | Imran Shaikh | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00239 | E1034 | Imran Shaikh | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00240 | E1034 | Imran Shaikh | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00241 | E1034 | Imran Shaikh | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00242 | E1034 | Imran Shaikh | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00243 | E1034 | Imran Shaikh | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00244 | E1034 | Imran Shaikh | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00245 | E1034 | Imran Shaikh | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00246 | E1034 | Imran Shaikh | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00247 | E1034 | Imran Shaikh | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00248 | E1034 | Imran Shaikh | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00249 | E1036 | Lakshmi Rao | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00250 | E1036 | Lakshmi Rao | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00251 | E1036 | Lakshmi Rao | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00252 | E1036 | Lakshmi Rao | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00253 | E1036 | Lakshmi Rao | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00254 | E1036 | Lakshmi Rao | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00255 | E1036 | Lakshmi Rao | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00256 | E1036 | Lakshmi Rao | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00257 | E1036 | Lakshmi Rao | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00258 | E1036 | Lakshmi Rao | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00259 | E1036 | Lakshmi Rao | 2026-09-06 | 1 | IN | 08:03 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00260 | E1036 | Lakshmi Rao | 2026-09-06 | 1 | OUT | 20:02 | 2026-09-06 | Biometric | BIO-PLA-03 |  |
| PE-00261 | E1036 | Lakshmi Rao | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00262 | E1036 | Lakshmi Rao | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00263 | E1036 | Lakshmi Rao | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00264 | E1036 | Lakshmi Rao | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00265 | E1036 | Lakshmi Rao | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00266 | E1036 | Lakshmi Rao | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00267 | E1036 | Lakshmi Rao | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00268 | E1036 | Lakshmi Rao | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00269 | E1036 | Lakshmi Rao | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00270 | E1036 | Lakshmi Rao | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00271 | E1036 | Lakshmi Rao | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00272 | E1036 | Lakshmi Rao | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00273 | E1036 | Lakshmi Rao | 2026-09-13 | 1 | IN | 07:55 | 2026-09-13 | Biometric | BIO-PLA-01 |  |
| PE-00274 | E1036 | Lakshmi Rao | 2026-09-13 | 1 | OUT | 20:07 | 2026-09-13 | Biometric | BIO-PLA-01 |  |
| PE-00275 | E1036 | Lakshmi Rao | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00276 | E1036 | Lakshmi Rao | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00277 | E1036 | Lakshmi Rao | 2026-09-15 | 1 | IN | 07:57 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00278 | E1036 | Lakshmi Rao | 2026-09-15 | 1 | OUT | 20:06 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00279 | E1041 | Mahesh Shinde | 2026-09-01 | 1 | IN | 06:55 | 2026-09-01 | Biometric | BIO-PUN-01 |  |
| PE-00280 | E1041 | Mahesh Shinde | 2026-09-01 | 1 | OUT | 17:06 | 2026-09-01 | Biometric | BIO-PUN-01 |  |
| PE-00281 | E1041 | Mahesh Shinde | 2026-09-02 | 1 | IN | 06:58 | 2026-09-02 | Biometric | BIO-PUN-02 |  |
| PE-00282 | E1041 | Mahesh Shinde | 2026-09-02 | 1 | OUT | 17:11 | 2026-09-02 | Biometric | BIO-PUN-02 |  |
| PE-00283 | E1041 | Mahesh Shinde | 2026-09-03 | 1 | IN | 06:53 | 2026-09-03 | Biometric | BIO-PUN-03 |  |
| PE-00284 | E1041 | Mahesh Shinde | 2026-09-03 | 1 | OUT | 17:03 | 2026-09-03 | Biometric | BIO-PUN-03 |  |
| PE-00285 | E1041 | Mahesh Shinde | 2026-09-04 | 1 | IN | 07:00 | 2026-09-04 | Biometric | BIO-PUN-01 |  |
| PE-00286 | E1041 | Mahesh Shinde | 2026-09-04 | 1 | OUT | 17:14 | 2026-09-04 | Biometric | BIO-PUN-01 |  |
| PE-00287 | E1041 | Mahesh Shinde | 2026-09-05 | 1 | IN | 06:56 | 2026-09-05 | Biometric | BIO-PUN-02 |  |
| PE-00288 | E1041 | Mahesh Shinde | 2026-09-05 | 1 | OUT | 17:08 | 2026-09-05 | Biometric | BIO-PUN-02 |  |
| PE-00289 | E1041 | Mahesh Shinde | 2026-09-07 | 1 | IN | 07:05 | 2026-09-07 | Biometric | BIO-PUN-01 |  |
| PE-00290 | E1041 | Mahesh Shinde | 2026-09-07 | 1 | OUT | 15:20 | 2026-09-07 | Biometric | BIO-PUN-01 |  |
| PE-00291 | E1041 | Mahesh Shinde | 2026-09-08 | 1 | IN | 06:59 | 2026-09-08 | Biometric | BIO-PUN-02 |  |
| PE-00292 | E1041 | Mahesh Shinde | 2026-09-08 | 1 | OUT | 17:05 | 2026-09-08 | Biometric | BIO-PUN-02 |  |
| PE-00293 | E1041 | Mahesh Shinde | 2026-09-09 | 1 | IN | 06:57 | 2026-09-09 | Biometric | BIO-PUN-03 |  |
| PE-00294 | E1041 | Mahesh Shinde | 2026-09-09 | 1 | OUT | 17:09 | 2026-09-09 | Biometric | BIO-PUN-03 |  |
| PE-00295 | E1041 | Mahesh Shinde | 2026-09-10 | 1 | IN | 07:01 | 2026-09-10 | Biometric | BIO-PUN-01 |  |
| PE-00296 | E1041 | Mahesh Shinde | 2026-09-10 | 1 | OUT | 17:12 | 2026-09-10 | Biometric | BIO-PUN-01 |  |
| PE-00297 | E1041 | Mahesh Shinde | 2026-09-11 | 1 | IN | 06:52 | 2026-09-11 | Biometric | BIO-PUN-02 |  |
| PE-00298 | E1041 | Mahesh Shinde | 2026-09-11 | 1 | OUT | 17:04 | 2026-09-11 | Biometric | BIO-PUN-02 |  |
| PE-00299 | E1041 | Mahesh Shinde | 2026-09-12 | 1 | IN | 07:02 | 2026-09-12 | Biometric | BIO-PUN-03 |  |
| PE-00300 | E1041 | Mahesh Shinde | 2026-09-12 | 1 | OUT | 17:19 | 2026-09-12 | Biometric | BIO-PUN-03 |  |
| PE-00301 | E1041 | Mahesh Shinde | 2026-09-14 | 1 | IN | 07:00 | 2026-09-14 | Biometric | BIO-PUN-02 |  |
| PE-00302 | E1041 | Mahesh Shinde | 2026-09-14 | 1 | OUT | 17:10 | 2026-09-14 | Biometric | BIO-PUN-02 |  |
| PE-00303 | E1041 | Mahesh Shinde | 2026-09-15 | 1 | IN | 06:57 | 2026-09-15 | Biometric | BIO-PUN-03 |  |
| PE-00304 | E1041 | Mahesh Shinde | 2026-09-15 | 1 | OUT | 17:06 | 2026-09-15 | Biometric | BIO-PUN-03 |  |
| PE-00305 | E1043 | Neha Mishra | 2026-09-01 | 1 | IN | 08:55 | 2026-09-01 | Biometric | BIO-PUN-01 |  |
| PE-00306 | E1043 | Neha Mishra | 2026-09-01 | 1 | OUT | 18:06 | 2026-09-01 | Biometric | BIO-PUN-01 |  |
| PE-00307 | E1043 | Neha Mishra | 2026-09-02 | 1 | IN | 08:58 | 2026-09-02 | Biometric | BIO-PUN-02 |  |
| PE-00308 | E1043 | Neha Mishra | 2026-09-02 | 1 | OUT | 18:11 | 2026-09-02 | Biometric | BIO-PUN-02 |  |
| PE-00309 | E1043 | Neha Mishra | 2026-09-03 | 1 | IN | 08:53 | 2026-09-03 | Biometric | BIO-PUN-03 |  |
| PE-00310 | E1043 | Neha Mishra | 2026-09-03 | 1 | OUT | 18:03 | 2026-09-03 | Biometric | BIO-PUN-03 |  |
| PE-00311 | E1043 | Neha Mishra | 2026-09-04 | 1 | IN | 09:00 | 2026-09-04 | Biometric | BIO-PUN-01 |  |
| PE-00312 | E1043 | Neha Mishra | 2026-09-04 | 1 | OUT | 18:14 | 2026-09-04 | Biometric | BIO-PUN-01 |  |
| PE-00313 | E1043 | Neha Mishra | 2026-09-05 | 1 | IN | 08:56 | 2026-09-05 | Biometric | BIO-PUN-02 |  |
| PE-00314 | E1043 | Neha Mishra | 2026-09-05 | 1 | OUT | 18:08 | 2026-09-05 | Biometric | BIO-PUN-02 |  |
| PE-00315 | E1043 | Neha Mishra | 2026-09-12 | 1 | IN | 09:02 | 2026-09-12 | Biometric | BIO-PUN-03 |  |
| PE-00316 | E1043 | Neha Mishra | 2026-09-12 | 1 | OUT | 18:19 | 2026-09-12 | Biometric | BIO-PUN-03 |  |
| PE-00317 | E1043 | Neha Mishra | 2026-09-14 | 1 | IN | 09:00 | 2026-09-14 | Biometric | BIO-PUN-02 |  |
| PE-00318 | E1043 | Neha Mishra | 2026-09-14 | 1 | OUT | 18:10 | 2026-09-14 | Biometric | BIO-PUN-02 |  |
| PE-00319 | E1043 | Neha Mishra | 2026-09-15 | 1 | IN | 08:57 | 2026-09-15 | Biometric | BIO-PUN-03 |  |
| PE-00320 | E1043 | Neha Mishra | 2026-09-15 | 1 | OUT | 18:06 | 2026-09-15 | Biometric | BIO-PUN-03 |  |
| PE-00321 | E1045 | Sunita Bhosale | 2026-09-01 | 1 | IN | 16:55 | 2026-09-01 | Biometric | BIO-PUN-01 |  |
| PE-00322 | E1045 | Sunita Bhosale | 2026-09-01 | 1 | OUT | 03:06 | 2026-09-02 | Biometric | BIO-PUN-01 | Next calendar day |
| PE-00323 | E1045 | Sunita Bhosale | 2026-09-02 | 1 | IN | 16:58 | 2026-09-02 | Biometric | BIO-PUN-02 |  |
| PE-00324 | E1045 | Sunita Bhosale | 2026-09-02 | 1 | OUT | 03:11 | 2026-09-03 | Biometric | BIO-PUN-02 | Next calendar day |
| PE-00325 | E1045 | Sunita Bhosale | 2026-09-03 | 1 | IN | 16:53 | 2026-09-03 | Biometric | BIO-PUN-03 |  |
| PE-00326 | E1045 | Sunita Bhosale | 2026-09-03 | 1 | OUT | 03:03 | 2026-09-04 | Biometric | BIO-PUN-03 | Next calendar day |
| PE-00327 | E1045 | Sunita Bhosale | 2026-09-04 | 1 | IN | 17:00 | 2026-09-04 | Biometric | BIO-PUN-01 |  |
| PE-00328 | E1045 | Sunita Bhosale | 2026-09-04 | 1 | OUT | 03:14 | 2026-09-05 | Biometric | BIO-PUN-01 | Next calendar day |
| PE-00329 | E1045 | Sunita Bhosale | 2026-09-05 | 1 | IN | 16:56 | 2026-09-05 | Biometric | BIO-PUN-02 |  |
| PE-00330 | E1045 | Sunita Bhosale | 2026-09-05 | 1 | OUT | 03:08 | 2026-09-06 | Biometric | BIO-PUN-02 | Next calendar day |
| PE-00331 | E1045 | Sunita Bhosale | 2026-09-07 | 1 | IN | 16:54 | 2026-09-07 | Biometric | BIO-PUN-01 |  |
| PE-00332 | E1045 | Sunita Bhosale | 2026-09-07 | 1 | OUT | 03:17 | 2026-09-08 | Biometric | BIO-PUN-01 | Next calendar day |
| PE-00333 | E1045 | Sunita Bhosale | 2026-09-08 | 1 | IN | 16:59 | 2026-09-08 | Biometric | BIO-PUN-02 |  |
| PE-00334 | E1045 | Sunita Bhosale | 2026-09-08 | 1 | OUT | 03:05 | 2026-09-09 | Biometric | BIO-PUN-02 | Next calendar day |
| PE-00335 | E1045 | Sunita Bhosale | 2026-09-09 | 1 | IN | 16:57 | 2026-09-09 | Biometric | BIO-PUN-03 |  |
| PE-00336 | E1045 | Sunita Bhosale | 2026-09-09 | 1 | OUT | 03:09 | 2026-09-10 | Biometric | BIO-PUN-03 | Next calendar day |
| PE-00337 | E1045 | Sunita Bhosale | 2026-09-10 | 1 | IN | 17:01 | 2026-09-10 | Biometric | BIO-PUN-01 |  |
| PE-00338 | E1045 | Sunita Bhosale | 2026-09-10 | 1 | OUT | 03:12 | 2026-09-11 | Biometric | BIO-PUN-01 | Next calendar day |
| PE-00339 | E1045 | Sunita Bhosale | 2026-09-11 | 1 | IN | 16:52 | 2026-09-11 | Biometric | BIO-PUN-02 |  |
| PE-00340 | E1045 | Sunita Bhosale | 2026-09-11 | 1 | OUT | 03:04 | 2026-09-12 | Biometric | BIO-PUN-02 | Next calendar day |
| PE-00341 | E1045 | Sunita Bhosale | 2026-09-12 | 1 | IN | 17:02 | 2026-09-12 | Biometric | BIO-PUN-03 |  |
| PE-00342 | E1045 | Sunita Bhosale | 2026-09-12 | 1 | OUT | 03:19 | 2026-09-13 | Biometric | BIO-PUN-03 | Next calendar day |
| PE-00343 | E1045 | Sunita Bhosale | 2026-09-14 | 1 | IN | 17:00 | 2026-09-14 | Biometric | BIO-PUN-02 |  |
| PE-00344 | E1045 | Sunita Bhosale | 2026-09-14 | 1 | OUT | 03:10 | 2026-09-15 | Biometric | BIO-PUN-02 | Next calendar day |
| PE-00345 | E1045 | Sunita Bhosale | 2026-09-15 | 1 | IN | 16:57 | 2026-09-15 | Biometric | BIO-PUN-03 |  |
| PE-00346 | E1045 | Sunita Bhosale | 2026-09-15 | 1 | OUT | 03:06 | 2026-09-16 | Biometric | BIO-PUN-03 | Next calendar day |
| PE-00347 | E1056 | Anand Krishnan | 2026-09-01 | 1 | IN | 07:55 | 2026-09-01 | Biometric | BIO-CHN-01 |  |
| PE-00348 | E1056 | Anand Krishnan | 2026-09-01 | 1 | OUT | 20:06 | 2026-09-01 | Biometric | BIO-CHN-01 |  |
| PE-00349 | E1056 | Anand Krishnan | 2026-09-02 | 1 | IN | 07:58 | 2026-09-02 | Biometric | BIO-CHN-02 |  |
| PE-00350 | E1056 | Anand Krishnan | 2026-09-02 | 1 | OUT | 20:11 | 2026-09-02 | Biometric | BIO-CHN-02 |  |
| PE-00351 | E1056 | Anand Krishnan | 2026-09-03 | 1 | IN | 07:53 | 2026-09-03 | Biometric | BIO-CHN-03 |  |
| PE-00352 | E1056 | Anand Krishnan | 2026-09-03 | 1 | OUT | 20:03 | 2026-09-03 | Biometric | BIO-CHN-03 |  |
| PE-00353 | E1056 | Anand Krishnan | 2026-09-04 | 1 | IN | 08:00 | 2026-09-04 | Biometric | BIO-CHN-01 |  |
| PE-00354 | E1056 | Anand Krishnan | 2026-09-04 | 1 | OUT | 20:14 | 2026-09-04 | Biometric | BIO-CHN-01 |  |
| PE-00355 | E1056 | Anand Krishnan | 2026-09-05 | 1 | IN | 07:56 | 2026-09-05 | Biometric | BIO-CHN-02 |  |
| PE-00356 | E1056 | Anand Krishnan | 2026-09-05 | 1 | OUT | 20:08 | 2026-09-05 | Biometric | BIO-CHN-02 |  |
| PE-00357 | E1056 | Anand Krishnan | 2026-09-07 | 1 | IN | 07:54 | 2026-09-07 | Biometric | BIO-CHN-01 |  |
| PE-00358 | E1056 | Anand Krishnan | 2026-09-07 | 1 | OUT | 20:17 | 2026-09-07 | Biometric | BIO-CHN-01 |  |
| PE-00359 | E1056 | Anand Krishnan | 2026-09-08 | 1 | IN | 07:59 | 2026-09-08 | Biometric | BIO-CHN-02 |  |
| PE-00360 | E1056 | Anand Krishnan | 2026-09-08 | 1 | OUT | 20:05 | 2026-09-08 | Biometric | BIO-CHN-02 |  |
| PE-00361 | E1056 | Anand Krishnan | 2026-09-09 | 1 | IN | 07:57 | 2026-09-09 | Biometric | BIO-CHN-03 |  |
| PE-00362 | E1056 | Anand Krishnan | 2026-09-09 | 1 | OUT | 20:09 | 2026-09-09 | Biometric | BIO-CHN-03 |  |
| PE-00363 | E1056 | Anand Krishnan | 2026-09-10 | 1 | IN | 08:01 | 2026-09-10 | Biometric | BIO-CHN-01 |  |
| PE-00364 | E1056 | Anand Krishnan | 2026-09-10 | 1 | OUT | 20:12 | 2026-09-10 | Biometric | BIO-CHN-01 |  |
| PE-00365 | E1056 | Anand Krishnan | 2026-09-11 | 1 | IN | 07:52 | 2026-09-11 | Biometric | BIO-CHN-02 |  |
| PE-00366 | E1056 | Anand Krishnan | 2026-09-11 | 1 | OUT | 20:04 | 2026-09-11 | Biometric | BIO-CHN-02 |  |
| PE-00367 | E1056 | Anand Krishnan | 2026-09-12 | 1 | IN | 08:02 | 2026-09-12 | Biometric | BIO-CHN-03 |  |
| PE-00368 | E1056 | Anand Krishnan | 2026-09-12 | 1 | OUT | 20:19 | 2026-09-12 | Biometric | BIO-CHN-03 |  |
| PE-00369 | E1056 | Anand Krishnan | 2026-09-14 | 1 | IN | 08:00 | 2026-09-14 | Biometric | BIO-CHN-02 |  |
| PE-00370 | E1056 | Anand Krishnan | 2026-09-14 | 1 | OUT | 20:10 | 2026-09-14 | Biometric | BIO-CHN-02 |  |
| PE-00371 | E1021 | Rekha Deshpande | 2026-09-01 | 1 | IN | 08:55 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00372 | E1021 | Rekha Deshpande | 2026-09-01 | 1 | OUT | 18:06 | 2026-09-01 | Biometric | BIO-PLA-01 |  |
| PE-00373 | E1021 | Rekha Deshpande | 2026-09-02 | 1 | IN | 09:32 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00374 | E1021 | Rekha Deshpande | 2026-09-02 | 1 | OUT | 18:40 | 2026-09-02 | Biometric | BIO-PLA-02 |  |
| PE-00375 | E1021 | Rekha Deshpande | 2026-09-03 | 1 | IN | 08:58 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00376 | E1021 | Rekha Deshpande | 2026-09-03 | 1 | OUT | 18:11 | 2026-09-03 | Biometric | BIO-PLA-03 |  |
| PE-00377 | E1021 | Rekha Deshpande | 2026-09-04 | 1 | IN | 09:41 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00378 | E1021 | Rekha Deshpande | 2026-09-04 | 1 | OUT | 18:50 | 2026-09-04 | Biometric | BIO-PLA-01 |  |
| PE-00379 | E1021 | Rekha Deshpande | 2026-09-05 | 1 | IN | 08:56 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00380 | E1021 | Rekha Deshpande | 2026-09-05 | 1 | OUT | 18:08 | 2026-09-05 | Biometric | BIO-PLA-02 |  |
| PE-00381 | E1021 | Rekha Deshpande | 2026-09-07 | 1 | IN | 09:28 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00382 | E1021 | Rekha Deshpande | 2026-09-07 | 1 | OUT | 18:35 | 2026-09-07 | Biometric | BIO-PLA-01 |  |
| PE-00383 | E1021 | Rekha Deshpande | 2026-09-08 | 1 | IN | 08:59 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00384 | E1021 | Rekha Deshpande | 2026-09-08 | 1 | OUT | 18:05 | 2026-09-08 | Biometric | BIO-PLA-02 |  |
| PE-00385 | E1021 | Rekha Deshpande | 2026-09-09 | 1 | IN | 09:35 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00386 | E1021 | Rekha Deshpande | 2026-09-09 | 1 | OUT | 18:44 | 2026-09-09 | Biometric | BIO-PLA-03 |  |
| PE-00387 | E1021 | Rekha Deshpande | 2026-09-10 | 1 | IN | 08:57 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00388 | E1021 | Rekha Deshpande | 2026-09-10 | 1 | OUT | 18:09 | 2026-09-10 | Biometric | BIO-PLA-01 |  |
| PE-00389 | E1021 | Rekha Deshpande | 2026-09-11 | 1 | IN | 09:22 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00390 | E1021 | Rekha Deshpande | 2026-09-11 | 1 | OUT | 18:30 | 2026-09-11 | Biometric | BIO-PLA-02 |  |
| PE-00391 | E1021 | Rekha Deshpande | 2026-09-12 | 1 | IN | 09:08 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00392 | E1021 | Rekha Deshpande | 2026-09-12 | 1 | OUT | 18:15 | 2026-09-12 | Biometric | BIO-PLA-03 |  |
| PE-00393 | E1021 | Rekha Deshpande | 2026-09-14 | 1 | IN | 08:57 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00394 | E1021 | Rekha Deshpande | 2026-09-14 | 1 | OUT | 18:06 | 2026-09-14 | Biometric | BIO-PLA-02 |  |
| PE-00395 | E1021 | Rekha Deshpande | 2026-09-15 | 1 | IN | 09:01 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| PE-00396 | E1021 | Rekha Deshpande | 2026-09-15 | 1 | OUT | 18:10 | 2026-09-15 | Biometric | BIO-PLA-03 |  |
| Raw events, never edited. Attendance date is the date the SHIFT started — note the rows where the punch calendar date is the following day. ADDED v1.1: 26 events for E1021 Rekha Deshpande across 13 working days. She was named in the demo script for the grade-exemption case but had no punches in v1.0, so that half of point 12 could not be shown. 394 events across 15 employees and 15 days. |  |  |  |  |  |  |  |  |  |  |

### `21_Expected_Attendance` (226 rows)

| Record | Employee code | Name | Date | Day | Shift assigned | Shift applied | Shift hours | Shift minutes | Day type | First in | Last out | Gross minutes | Break minutes (recorded, paid) | Gate pass minutes (deducted) | Gate pass credit (approved) | OT eligibility | Late by (min) | Late instance no | Late beyond allowance | Long-night relief | Note | Net minutes | Overtime minutes | Expected status | Net (h:mm) | OT (h:mm) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AD-00001 | E1018 | Ravi Kulkarni | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00002 | E1018 | Ravi Kulkarni | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00003 | E1018 | Ravi Kulkarni | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00004 | E1018 | Ravi Kulkarni | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00005 | E1018 | Ravi Kulkarni | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00006 | E1018 | Ravi Kulkarni | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00007 | E1018 | Ravi Kulkarni | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00008 | E1018 | Ravi Kulkarni | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 08:00 | 03:20 | 1160 | 45 | 0 | 0 | All |  |  | N | N | Point 1 — two segments, 45-min dinner break, day runs to 03:20 | 1160 | 440 | Present | 19:20 | 7:20 |
| AD-00009 | E1018 | Ravi Kulkarni | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 09:25 | 20:10 | 645 | 45 | 0 | 0 | All | 85 |  | N | Y | Point 12 — long-night relief after a 03:20 finish; full day despite 10h45m span | 645 | 0 | Present | 10:45 | - |
| AD-00010 | E1018 | Ravi Kulkarni | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00011 | E1018 | Ravi Kulkarni | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00012 | E1018 | Ravi Kulkarni | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00013 | E1018 | Ravi Kulkarni | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00014 | E1018 | Ravi Kulkarni | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00015 | E1018 | Ravi Kulkarni | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00016 | E1019 | Sneha Nair | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 08:22 | 20:06 | 704 | 60 | 0 | 0 | All | 22 | 1 | N | N | Late instance 1 — within allowance | 704 | 0 | Present | 11:44 | - |
| AD-00017 | E1019 | Sneha Nair | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00018 | E1019 | Sneha Nair | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:31 | 20:11 | 700 | 60 | 0 | 0 | All | 31 | 2 | N | N | Late instance 2 — within allowance | 700 | 0 | Present | 11:40 | - |
| AD-00019 | E1019 | Sneha Nair | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00020 | E1019 | Sneha Nair | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00021 | E1019 | Sneha Nair | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00022 | E1019 | Sneha Nair | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:19 | 20:03 | 704 | 60 | 0 | 0 | All | 19 | 3 | N | N | Late instance 3 — within allowance | 704 | 0 | Present | 11:44 | - |
| AD-00023 | E1019 | Sneha Nair | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00024 | E1019 | Sneha Nair | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00025 | E1019 | Sneha Nair | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:27 | 20:09 | 702 | 60 | 0 | 0 | All | 27 | 4 | Y | N | Point 12 — late instance 4, half day | 702 | 0 | Half Day | 11:42 | - |
| AD-00026 | E1019 | Sneha Nair | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00027 | E1019 | Sneha Nair | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00028 | E1019 | Sneha Nair | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00029 | E1019 | Sneha Nair | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:24 | 20:14 | 710 | 60 | 0 | 0 | All | 24 | 5 | Y | N | Point 12 — late instance 5, half day | 710 | 0 | Half Day | 11:50 | - |
| AD-00030 | E1019 | Sneha Nair | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00031 | E1020 | Arjun Bhat | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00032 | E1020 | Arjun Bhat | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00033 | E1020 | Arjun Bhat | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00034 | E1020 | Arjun Bhat | 2026-09-04 | Fri | SH-A | SH-B | 12 | 720 | Working | 20:05 | 08:40 | 755 | 60 | 0 | 0 | All | 5 |  | N | N | Point 13 — in-punch inside B-shift window, shift auto-inferred | 755 | 35 | Present | 12:35 | 0:35 |
| AD-00035 | E1020 | Arjun Bhat | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00036 | E1020 | Arjun Bhat | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00037 | E1020 | Arjun Bhat | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00038 | E1020 | Arjun Bhat | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00039 | E1020 | Arjun Bhat | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00040 | E1020 | Arjun Bhat | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00041 | E1020 | Arjun Bhat | 2026-09-11 | Fri | SH-A | SH-B | 12 | 720 | Working | 19:58 | 08:36 | 758 | 60 | 0 | 0 | All |  |  | N | N | Point 13 — second inferred B-shift day | 758 | 38 | Present | 12:38 | 0:38 |
| AD-00042 | E1020 | Arjun Bhat | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00043 | E1020 | Arjun Bhat | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00044 | E1020 | Arjun Bhat | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00045 | E1020 | Arjun Bhat | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00046 | E1022 | Mohan Joseph | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00047 | E1022 | Mohan Joseph | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 08:05 | 18:30 | 625 | 60 | 0 | 0 | All | 5 |  | N | N | Point 12 — net 9h25m, below 11h30m, half day | 625 | 0 | Half Day | 10:25 | - |
| AD-00048 | E1022 | Mohan Joseph | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00049 | E1022 | Mohan Joseph | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00050 | E1022 | Mohan Joseph | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00051 | E1022 | Mohan Joseph | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00052 | E1022 | Mohan Joseph | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00053 | E1022 | Mohan Joseph | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00054 | E1022 | Mohan Joseph | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 08:10 | 13:15 | 305 | 0 | 0 | 0 | All | 10 |  | N | N | Point 12 — net 5h05m, below 6h30m, absent | 305 | 0 | Absent | 5:05 | - |
| AD-00055 | E1022 | Mohan Joseph | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00056 | E1022 | Mohan Joseph | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00057 | E1022 | Mohan Joseph | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00058 | E1022 | Mohan Joseph | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00059 | E1022 | Mohan Joseph | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00060 | E1022 | Mohan Joseph | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00061 | E1023 | Kavya Venkatesh | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00062 | E1023 | Kavya Venkatesh | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00063 | E1023 | Kavya Venkatesh | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00064 | E1023 | Kavya Venkatesh | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:04 | 722 | 0 | 120 | 120 | All | 2 |  | N | N | Point 11 — 2h personal gate pass GP-2026-0141, credited to work hours | 722 | 2 | Present | 12:02 | 0:02 |
| AD-00065 | E1023 | Kavya Venkatesh | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00066 | E1023 | Kavya Venkatesh | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00067 | E1023 | Kavya Venkatesh | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00068 | E1023 | Kavya Venkatesh | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00069 | E1023 | Kavya Venkatesh | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00070 | E1023 | Kavya Venkatesh | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00071 | E1023 | Kavya Venkatesh | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:06 | 20:08 | 722 | 0 | 120 | 120 | All | 6 |  | N | N | Point 11 — 2h gate pass GP-2026-0155, monthly ceiling of 4h now reached | 722 | 2 | Present | 12:02 | 0:02 |
| AD-00072 | E1023 | Kavya Venkatesh | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00073 | E1023 | Kavya Venkatesh | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00074 | E1023 | Kavya Venkatesh | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00075 | E1023 | Kavya Venkatesh | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00076 | E1026 | Manjunath Poojary | 2026-09-01 | Tue | SH-B | SH-B | 12 | 720 | Working | 19:55 | 08:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00077 | E1026 | Manjunath Poojary | 2026-09-02 | Wed | SH-B | SH-B | 12 | 720 | Working | 19:58 | 08:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00078 | E1026 | Manjunath Poojary | 2026-09-03 | Thu | SH-B | SH-B | 12 | 720 | Working | 19:53 | 08:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00079 | E1026 | Manjunath Poojary | 2026-09-04 | Fri | SH-B | SH-B | 12 | 720 | Working | 20:00 | 08:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00080 | E1026 | Manjunath Poojary | 2026-09-05 | Sat | SH-B | SH-B | 12 | 720 | Working | 19:56 | 08:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00081 | E1026 | Manjunath Poojary | 2026-09-06 | Sun | SH-B | SH-B | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00082 | E1026 | Manjunath Poojary | 2026-09-07 | Mon | SH-B | SH-B | 12 | 720 | Working | 19:54 | 08:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00083 | E1026 | Manjunath Poojary | 2026-09-08 | Tue | SH-B | SH-B | 12 | 720 | Working | 19:59 | 08:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00084 | E1026 | Manjunath Poojary | 2026-09-09 | Wed | SH-B | SH-B | 12 | 720 | Working | 19:57 | 08:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00085 | E1026 | Manjunath Poojary | 2026-09-10 | Thu | SH-B | SH-B | 12 | 720 | Working | 20:01 | 08:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00086 | E1026 | Manjunath Poojary | 2026-09-11 | Fri | SH-B | SH-B | 12 | 720 | Working | 19:52 | 08:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00087 | E1026 | Manjunath Poojary | 2026-09-12 | Sat | SH-B | SH-B | 12 | 720 | Working | 20:02 | 08:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00088 | E1026 | Manjunath Poojary | 2026-09-13 | Sun | SH-B | SH-B | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00089 | E1026 | Manjunath Poojary | 2026-09-14 | Mon | SH-B | SH-B | 12 | 720 | Working | 20:00 | 08:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00090 | E1026 | Manjunath Poojary | 2026-09-15 | Tue | SH-B | SH-B | 12 | 720 | Working | 19:57 | 08:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00091 | E1028 | Yashoda Rani | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00092 | E1028 | Yashoda Rani | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00093 | E1028 | Yashoda Rani | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00094 | E1028 | Yashoda Rani | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00095 | E1028 | Yashoda Rani | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00096 | E1028 | Yashoda Rani | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off | 08:04 | 20:12 | 728 | 60 | 0 | 0 | All |  |  | N | N | Point 6 — rest-day working, comp-off CO-2026-0288 credited, expires 05 Nov 2026 | 728 | 728 | Weekly Off — worked | 12:08 | 12:08 |
| AD-00097 | E1028 | Yashoda Rani | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00098 | E1028 | Yashoda Rani | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00099 | E1028 | Yashoda Rani | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00100 | E1028 | Yashoda Rani | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00101 | E1028 | Yashoda Rani | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00102 | E1028 | Yashoda Rani | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00103 | E1028 | Yashoda Rani | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00104 | E1028 | Yashoda Rani | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00105 | E1028 | Yashoda Rani | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00106 | E1032 | Shivanna Muniyappa | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00107 | E1032 | Shivanna Muniyappa | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00108 | E1032 | Shivanna Muniyappa | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00109 | E1032 | Shivanna Muniyappa | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00110 | E1032 | Shivanna Muniyappa | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00111 | E1032 | Shivanna Muniyappa | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Working | 08:03 | 20:02 | 719 | 60 | 0 | 0 | All | 3 |  | N | N |  | 719 | 0 | Present | 11:59 | - |
| AD-00112 | E1032 | Shivanna Muniyappa | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00113 | E1032 | Shivanna Muniyappa | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00114 | E1032 | Shivanna Muniyappa | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00115 | E1032 | Shivanna Muniyappa | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00116 | E1032 | Shivanna Muniyappa | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00117 | E1032 | Shivanna Muniyappa | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00118 | E1032 | Shivanna Muniyappa | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:07 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00119 | E1032 | Shivanna Muniyappa | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00120 | E1032 | Shivanna Muniyappa | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | All |  |  | N | N |  | 729 | 9 | Present | 12:09 | 0:09 |
| AD-00121 | E1034 | Imran Shaikh | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 731 | 0 | Present | 12:11 | - |
| AD-00122 | E1034 | Imran Shaikh | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 733 | 0 | Present | 12:13 | - |
| AD-00123 | E1034 | Imran Shaikh | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 730 | 0 | Present | 12:10 | - |
| AD-00124 | E1034 | Imran Shaikh | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 734 | 0 | Present | 12:14 | - |
| AD-00125 | E1034 | Imran Shaikh | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00126 | E1034 | Imran Shaikh | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off | 08:03 | 20:11 | 728 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N | Points 3, 4 — rest-day working; the whole span is payable as overtime | 728 | 728 | Weekly Off — worked | 12:08 | 12:08 |
| AD-00127 | E1034 | Imran Shaikh | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 743 | 0 | Present | 12:23 | - |
| AD-00128 | E1034 | Imran Shaikh | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 726 | 0 | Present | 12:06 | - |
| AD-00129 | E1034 | Imran Shaikh | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00130 | E1034 | Imran Shaikh | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | RestDayHolidayOnly | 1 |  | N | N |  | 731 | 0 | Present | 12:11 | - |
| AD-00131 | E1034 | Imran Shaikh | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00132 | E1034 | Imran Shaikh | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | RestDayHolidayOnly | 2 |  | N | N |  | 737 | 0 | Present | 12:17 | - |
| AD-00133 | E1034 | Imran Shaikh | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00134 | E1034 | Imran Shaikh | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 730 | 0 | Present | 12:10 | - |
| AD-00135 | E1034 | Imran Shaikh | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 729 | 0 | Present | 12:09 | - |
| AD-00136 | E1036 | Lakshmi Rao | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 731 | 0 | Present | 12:11 | - |
| AD-00137 | E1036 | Lakshmi Rao | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 733 | 0 | Present | 12:13 | - |
| AD-00138 | E1036 | Lakshmi Rao | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 730 | 0 | Present | 12:10 | - |
| AD-00139 | E1036 | Lakshmi Rao | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 734 | 0 | Present | 12:14 | - |
| AD-00140 | E1036 | Lakshmi Rao | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00141 | E1036 | Lakshmi Rao | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Working | 08:03 | 20:02 | 719 | 60 | 0 | 0 | RestDayHolidayOnly | 3 |  | N | N |  | 719 | 0 | Present | 11:59 | - |
| AD-00142 | E1036 | Lakshmi Rao | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 743 | 0 | Present | 12:23 | - |
| AD-00143 | E1036 | Lakshmi Rao | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 726 | 0 | Present | 12:06 | - |
| AD-00144 | E1036 | Lakshmi Rao | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00145 | E1036 | Lakshmi Rao | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | RestDayHolidayOnly | 1 |  | N | N |  | 731 | 0 | Present | 12:11 | - |
| AD-00146 | E1036 | Lakshmi Rao | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00147 | E1036 | Lakshmi Rao | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | RestDayHolidayOnly | 2 |  | N | N |  | 737 | 0 | Present | 12:17 | - |
| AD-00148 | E1036 | Lakshmi Rao | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:07 | 732 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 732 | 0 | Present | 12:12 | - |
| AD-00149 | E1036 | Lakshmi Rao | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 730 | 0 | Present | 12:10 | - |
| AD-00150 | E1036 | Lakshmi Rao | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:06 | 729 | 60 | 0 | 0 | RestDayHolidayOnly |  |  | N | N |  | 729 | 0 | Present | 12:09 | - |
| AD-00151 | E1041 | Mahesh Shinde | 2026-09-01 | Tue | SH-C | SH-C | 10 | 600 | Working | 06:55 | 17:06 | 611 | 45 | 0 | 0 | All |  |  | N | N |  | 611 | 11 | Present | 10:11 | 0:11 |
| AD-00152 | E1041 | Mahesh Shinde | 2026-09-02 | Wed | SH-C | SH-C | 10 | 600 | Working | 06:58 | 17:11 | 613 | 45 | 0 | 0 | All |  |  | N | N |  | 613 | 13 | Present | 10:13 | 0:13 |
| AD-00153 | E1041 | Mahesh Shinde | 2026-09-03 | Thu | SH-C | SH-C | 10 | 600 | Working | 06:53 | 17:03 | 610 | 45 | 0 | 0 | All |  |  | N | N |  | 610 | 10 | Present | 10:10 | 0:10 |
| AD-00154 | E1041 | Mahesh Shinde | 2026-09-04 | Fri | SH-C | SH-C | 10 | 600 | Working | 07:00 | 17:14 | 614 | 45 | 0 | 0 | All |  |  | N | N |  | 614 | 14 | Present | 10:14 | 0:14 |
| AD-00155 | E1041 | Mahesh Shinde | 2026-09-05 | Sat | SH-C | SH-C | 10 | 600 | Working | 06:56 | 17:08 | 612 | 45 | 0 | 0 | All |  |  | N | N |  | 612 | 12 | Present | 10:12 | 0:12 |
| AD-00156 | E1041 | Mahesh Shinde | 2026-09-06 | Sun | SH-C | SH-C | 10 | 600 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00157 | E1041 | Mahesh Shinde | 2026-09-07 | Mon | SH-C | SH-C | 10 | 600 | Working | 07:05 | 15:20 | 495 | 45 | 0 | 0 | All | 5 |  | N | N | Point 12 — 10h shift, net 7h30m, below 9h30m, half day | 495 | 0 | Half Day | 8:15 | - |
| AD-00158 | E1041 | Mahesh Shinde | 2026-09-08 | Tue | SH-C | SH-C | 10 | 600 | Working | 06:59 | 17:05 | 606 | 45 | 0 | 0 | All |  |  | N | N |  | 606 | 6 | Present | 10:06 | 0:06 |
| AD-00159 | E1041 | Mahesh Shinde | 2026-09-09 | Wed | SH-C | SH-C | 10 | 600 | Working | 06:57 | 17:09 | 612 | 45 | 0 | 0 | All |  |  | N | N |  | 612 | 12 | Present | 10:12 | 0:12 |
| AD-00160 | E1041 | Mahesh Shinde | 2026-09-10 | Thu | SH-C | SH-C | 10 | 600 | Working | 07:01 | 17:12 | 611 | 45 | 0 | 0 | All | 1 |  | N | N |  | 611 | 11 | Present | 10:11 | 0:11 |
| AD-00161 | E1041 | Mahesh Shinde | 2026-09-11 | Fri | SH-C | SH-C | 10 | 600 | Working | 06:52 | 17:04 | 612 | 45 | 0 | 0 | All |  |  | N | N |  | 612 | 12 | Present | 10:12 | 0:12 |
| AD-00162 | E1041 | Mahesh Shinde | 2026-09-12 | Sat | SH-C | SH-C | 10 | 600 | Working | 07:02 | 17:19 | 617 | 45 | 0 | 0 | All | 2 |  | N | N |  | 617 | 17 | Present | 10:17 | 0:17 |
| AD-00163 | E1041 | Mahesh Shinde | 2026-09-13 | Sun | SH-C | SH-C | 10 | 600 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00164 | E1041 | Mahesh Shinde | 2026-09-14 | Mon | SH-C | SH-C | 10 | 600 | Working | 07:00 | 17:10 | 610 | 45 | 0 | 0 | All |  |  | N | N |  | 610 | 10 | Present | 10:10 | 0:10 |
| AD-00165 | E1041 | Mahesh Shinde | 2026-09-15 | Tue | SH-C | SH-C | 10 | 600 | Working | 06:57 | 17:06 | 609 | 45 | 0 | 0 | All |  |  | N | N |  | 609 | 9 | Present | 10:09 | 0:09 |
| AD-00166 | E1043 | Neha Mishra | 2026-09-01 | Tue | SH-E | SH-E | 9 | 540 | Working | 08:55 | 18:06 | 551 | 45 | 0 | 0 | All |  |  | N | N |  | 551 | 11 | Present | 9:11 | 0:11 |
| AD-00167 | E1043 | Neha Mishra | 2026-09-02 | Wed | SH-E | SH-E | 9 | 540 | Working | 08:58 | 18:11 | 553 | 45 | 0 | 0 | All |  |  | N | N |  | 553 | 13 | Present | 9:13 | 0:13 |
| AD-00168 | E1043 | Neha Mishra | 2026-09-03 | Thu | SH-E | SH-E | 9 | 540 | Working | 08:53 | 18:03 | 550 | 45 | 0 | 0 | All |  |  | N | N |  | 550 | 10 | Present | 9:10 | 0:10 |
| AD-00169 | E1043 | Neha Mishra | 2026-09-04 | Fri | SH-E | SH-E | 9 | 540 | Working | 09:00 | 18:14 | 554 | 45 | 0 | 0 | All |  |  | N | N |  | 554 | 14 | Present | 9:14 | 0:14 |
| AD-00170 | E1043 | Neha Mishra | 2026-09-05 | Sat | SH-E | SH-E | 9 | 540 | Working | 08:56 | 18:08 | 552 | 45 | 0 | 0 | All |  |  | N | N |  | 552 | 12 | Present | 9:12 | 0:12 |
| AD-00171 | E1043 | Neha Mishra | 2026-09-06 | Sun | SH-E | SH-E | 9 | 540 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00172 | E1043 | Neha Mishra | 2026-09-07 | Mon | SH-E | SH-E | 9 | 540 | On Leave |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N | On approved leave | 0 | 0 | On Leave | - | - |
| AD-00173 | E1043 | Neha Mishra | 2026-09-08 | Tue | SH-E | SH-E | 9 | 540 | On Leave |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N | On approved leave | 0 | 0 | On Leave | - | - |
| AD-00174 | E1043 | Neha Mishra | 2026-09-09 | Wed | SH-E | SH-E | 9 | 540 | On Leave |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N | On approved leave | 0 | 0 | On Leave | - | - |
| AD-00175 | E1043 | Neha Mishra | 2026-09-10 | Thu | SH-E | SH-E | 9 | 540 | On Leave |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N | On approved leave | 0 | 0 | On Leave | - | - |
| AD-00176 | E1043 | Neha Mishra | 2026-09-11 | Fri | SH-E | SH-E | 9 | 540 | On Leave |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N | On approved leave | 0 | 0 | On Leave | - | - |
| AD-00177 | E1043 | Neha Mishra | 2026-09-12 | Sat | SH-E | SH-E | 9 | 540 | Working | 09:02 | 18:19 | 557 | 45 | 0 | 0 | All | 2 |  | N | N |  | 557 | 17 | Present | 9:17 | 0:17 |
| AD-00178 | E1043 | Neha Mishra | 2026-09-13 | Sun | SH-E | SH-E | 9 | 540 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00179 | E1043 | Neha Mishra | 2026-09-14 | Mon | SH-E | SH-E | 9 | 540 | Working | 09:00 | 18:10 | 550 | 45 | 0 | 0 | All |  |  | N | N |  | 550 | 10 | Present | 9:10 | 0:10 |
| AD-00180 | E1043 | Neha Mishra | 2026-09-15 | Tue | SH-E | SH-E | 9 | 540 | Working | 08:57 | 18:06 | 549 | 45 | 0 | 0 | All |  |  | N | N |  | 549 | 9 | Present | 9:09 | 0:09 |
| AD-00181 | E1045 | Sunita Bhosale | 2026-09-01 | Tue | SH-D | SH-D | 10 | 600 | Working | 16:55 | 03:06 | 611 | 45 | 0 | 0 | All |  |  | N | N |  | 611 | 11 | Present | 10:11 | 0:11 |
| AD-00182 | E1045 | Sunita Bhosale | 2026-09-02 | Wed | SH-D | SH-D | 10 | 600 | Working | 16:58 | 03:11 | 613 | 45 | 0 | 0 | All |  |  | N | N |  | 613 | 13 | Present | 10:13 | 0:13 |
| AD-00183 | E1045 | Sunita Bhosale | 2026-09-03 | Thu | SH-D | SH-D | 10 | 600 | Working | 16:53 | 03:03 | 610 | 45 | 0 | 0 | All |  |  | N | N |  | 610 | 10 | Present | 10:10 | 0:10 |
| AD-00184 | E1045 | Sunita Bhosale | 2026-09-04 | Fri | SH-D | SH-D | 10 | 600 | Working | 17:00 | 03:14 | 614 | 45 | 0 | 0 | All |  |  | N | N |  | 614 | 14 | Present | 10:14 | 0:14 |
| AD-00185 | E1045 | Sunita Bhosale | 2026-09-05 | Sat | SH-D | SH-D | 10 | 600 | Working | 16:56 | 03:08 | 612 | 45 | 0 | 0 | All |  |  | N | N |  | 612 | 12 | Present | 10:12 | 0:12 |
| AD-00186 | E1045 | Sunita Bhosale | 2026-09-06 | Sun | SH-D | SH-D | 10 | 600 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00187 | E1045 | Sunita Bhosale | 2026-09-07 | Mon | SH-D | SH-D | 10 | 600 | Working | 16:54 | 03:17 | 623 | 45 | 0 | 0 | All |  |  | N | N |  | 623 | 23 | Present | 10:23 | 0:23 |
| AD-00188 | E1045 | Sunita Bhosale | 2026-09-08 | Tue | SH-D | SH-D | 10 | 600 | Working | 16:59 | 03:05 | 606 | 45 | 0 | 0 | All |  |  | N | N |  | 606 | 6 | Present | 10:06 | 0:06 |
| AD-00189 | E1045 | Sunita Bhosale | 2026-09-09 | Wed | SH-D | SH-D | 10 | 600 | Working | 16:57 | 03:09 | 612 | 45 | 0 | 0 | All |  |  | N | N |  | 612 | 12 | Present | 10:12 | 0:12 |
| AD-00190 | E1045 | Sunita Bhosale | 2026-09-10 | Thu | SH-D | SH-D | 10 | 600 | Working | 17:01 | 03:12 | 611 | 45 | 0 | 0 | All | 1 |  | N | N |  | 611 | 11 | Present | 10:11 | 0:11 |
| AD-00191 | E1045 | Sunita Bhosale | 2026-09-11 | Fri | SH-D | SH-D | 10 | 600 | Working | 16:52 | 03:04 | 612 | 45 | 0 | 0 | All |  |  | N | N |  | 612 | 12 | Present | 10:12 | 0:12 |
| AD-00192 | E1045 | Sunita Bhosale | 2026-09-12 | Sat | SH-D | SH-D | 10 | 600 | Working | 17:02 | 03:19 | 617 | 45 | 0 | 0 | All | 2 |  | N | N |  | 617 | 17 | Present | 10:17 | 0:17 |
| AD-00193 | E1045 | Sunita Bhosale | 2026-09-13 | Sun | SH-D | SH-D | 10 | 600 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00194 | E1045 | Sunita Bhosale | 2026-09-14 | Mon | SH-D | SH-D | 10 | 600 | Working | 17:00 | 03:10 | 610 | 45 | 0 | 0 | All |  |  | N | N |  | 610 | 10 | Present | 10:10 | 0:10 |
| AD-00195 | E1045 | Sunita Bhosale | 2026-09-15 | Tue | SH-D | SH-D | 10 | 600 | Working | 16:57 | 03:06 | 609 | 45 | 0 | 0 | All |  |  | N | N |  | 609 | 9 | Present | 10:09 | 0:09 |
| AD-00196 | E1056 | Anand Krishnan | 2026-09-01 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:55 | 20:06 | 731 | 60 | 0 | 0 | All |  |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00197 | E1056 | Anand Krishnan | 2026-09-02 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:58 | 20:11 | 733 | 60 | 0 | 0 | All |  |  | N | N |  | 733 | 13 | Present | 12:13 | 0:13 |
| AD-00198 | E1056 | Anand Krishnan | 2026-09-03 | Thu | SH-A | SH-A | 12 | 720 | Working | 07:53 | 20:03 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00199 | E1056 | Anand Krishnan | 2026-09-04 | Fri | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:14 | 734 | 60 | 0 | 0 | All |  |  | N | N |  | 734 | 14 | Present | 12:14 | 0:14 |
| AD-00200 | E1056 | Anand Krishnan | 2026-09-05 | Sat | SH-A | SH-A | 12 | 720 | Working | 07:56 | 20:08 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00201 | E1056 | Anand Krishnan | 2026-09-06 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00202 | E1056 | Anand Krishnan | 2026-09-07 | Mon | SH-A | SH-A | 12 | 720 | Working | 07:54 | 20:17 | 743 | 60 | 0 | 0 | All |  |  | N | N |  | 743 | 23 | Present | 12:23 | 0:23 |
| AD-00203 | E1056 | Anand Krishnan | 2026-09-08 | Tue | SH-A | SH-A | 12 | 720 | Working | 07:59 | 20:05 | 726 | 60 | 0 | 0 | All |  |  | N | N |  | 726 | 6 | Present | 12:06 | 0:06 |
| AD-00204 | E1056 | Anand Krishnan | 2026-09-09 | Wed | SH-A | SH-A | 12 | 720 | Working | 07:57 | 20:09 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00205 | E1056 | Anand Krishnan | 2026-09-10 | Thu | SH-A | SH-A | 12 | 720 | Working | 08:01 | 20:12 | 731 | 60 | 0 | 0 | All | 1 |  | N | N |  | 731 | 11 | Present | 12:11 | 0:11 |
| AD-00206 | E1056 | Anand Krishnan | 2026-09-11 | Fri | SH-A | SH-A | 12 | 720 | Working | 07:52 | 20:04 | 732 | 60 | 0 | 0 | All |  |  | N | N |  | 732 | 12 | Present | 12:12 | 0:12 |
| AD-00207 | E1056 | Anand Krishnan | 2026-09-12 | Sat | SH-A | SH-A | 12 | 720 | Working | 08:02 | 20:19 | 737 | 60 | 0 | 0 | All | 2 |  | N | N |  | 737 | 17 | Present | 12:17 | 0:17 |
| AD-00208 | E1056 | Anand Krishnan | 2026-09-13 | Sun | SH-A | SH-A | 12 | 720 | Weekly Off |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00209 | E1056 | Anand Krishnan | 2026-09-14 | Mon | SH-A | SH-A | 12 | 720 | Working | 08:00 | 20:10 | 730 | 60 | 0 | 0 | All |  |  | N | N |  | 730 | 10 | Present | 12:10 | 0:10 |
| AD-00210 | E1056 | Anand Krishnan | 2026-09-15 | Tue | SH-A | SH-A | 12 | 720 | Holiday |  |  | 0 | 0 | 0 | 0 | All |  |  | N | N |  | 0 | 0 | Holiday | - | - |
| AD-00211 | E1021 | Rekha Deshpande | 2026-09-01 | Tue | SH-E | SH-E | 9 | 540 | Working | 08:55 | 18:06 | 551 | 45 | 0 | 0 | None |  |  | N | N |  | 551 | 0 | Present | 9:11 | - |
| AD-00212 | E1021 | Rekha Deshpande | 2026-09-02 | Wed | SH-E | SH-E | 9 | 540 | Working | 09:32 | 18:40 | 548 | 45 | 0 | 0 | None | 32 | 1 | N | N | Late instance 1 — beyond the 15-minute grace | 548 | 0 | Present | 9:08 | - |
| AD-00213 | E1021 | Rekha Deshpande | 2026-09-03 | Thu | SH-E | SH-E | 9 | 540 | Working | 08:58 | 18:11 | 553 | 45 | 0 | 0 | None |  |  | N | N |  | 553 | 0 | Present | 9:13 | - |
| AD-00214 | E1021 | Rekha Deshpande | 2026-09-04 | Fri | SH-E | SH-E | 9 | 540 | Working | 09:41 | 18:50 | 549 | 45 | 0 | 0 | None | 41 | 2 | N | N | Late instance 2 — beyond grace | 549 | 0 | Present | 9:09 | - |
| AD-00215 | E1021 | Rekha Deshpande | 2026-09-05 | Sat | SH-E | SH-E | 9 | 540 | Working | 08:56 | 18:08 | 552 | 45 | 0 | 0 | None |  |  | N | N |  | 552 | 0 | Present | 9:12 | - |
| AD-00216 | E1021 | Rekha Deshpande | 2026-09-06 | Sun | SH-E | SH-E | 9 | 540 | Weekly Off |  |  | 0 | 0 | 0 | 0 | None |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00217 | E1021 | Rekha Deshpande | 2026-09-07 | Mon | SH-E | SH-E | 9 | 540 | Working | 09:28 | 18:35 | 547 | 45 | 0 | 0 | None | 28 | 3 | N | N | Late instance 3 — beyond grace, allowance now exhausted | 547 | 0 | Present | 9:07 | - |
| AD-00218 | E1021 | Rekha Deshpande | 2026-09-08 | Tue | SH-E | SH-E | 9 | 540 | Working | 08:59 | 18:05 | 546 | 45 | 0 | 0 | None |  |  | N | N |  | 546 | 0 | Present | 9:06 | - |
| AD-00219 | E1021 | Rekha Deshpande | 2026-09-09 | Wed | SH-E | SH-E | 9 | 540 | Working | 09:35 | 18:44 | 549 | 45 | 0 | 0 | None | 35 | 4 | N | N | Point 12 — late instance 4. For a non-exempt employee this is a half day. E1021 is a Manager at grade rank 55, above the exempt rank of 50, so the day stays Present and no deduction is raised. | 549 | 0 | Present | 9:09 | - |
| AD-00220 | E1021 | Rekha Deshpande | 2026-09-10 | Thu | SH-E | SH-E | 9 | 540 | Working | 08:57 | 18:09 | 552 | 45 | 0 | 0 | None |  |  | N | N |  | 552 | 0 | Present | 9:12 | - |
| AD-00221 | E1021 | Rekha Deshpande | 2026-09-11 | Fri | SH-E | SH-E | 9 | 540 | Working | 09:22 | 18:30 | 548 | 45 | 0 | 0 | None | 22 | 5 | N | N | Point 12 — late instance 5, still Present | 548 | 0 | Present | 9:08 | - |
| AD-00222 | E1021 | Rekha Deshpande | 2026-09-12 | Sat | SH-E | SH-E | 9 | 540 | Working | 09:08 | 18:15 | 547 | 45 | 0 | 0 | None | 8 |  | N | N | Within the 15-minute grace — not a late instance | 547 | 0 | Present | 9:07 | - |
| AD-00223 | E1021 | Rekha Deshpande | 2026-09-13 | Sun | SH-E | SH-E | 9 | 540 | Weekly Off |  |  | 0 | 0 | 0 | 0 | None |  |  | N | N |  | 0 | 0 | Weekly Off | - | - |
| AD-00224 | E1021 | Rekha Deshpande | 2026-09-14 | Mon | SH-E | SH-E | 9 | 540 | Working | 08:57 | 18:06 | 549 | 45 | 0 | 0 | None |  |  | N | N |  | 549 | 0 | Present | 9:09 | - |
| AD-00225 | E1021 | Rekha Deshpande | 2026-09-15 | Tue | SH-E | SH-E | 9 | 540 | Working | 09:01 | 18:10 | 549 | 45 | 0 | 0 | None | 1 |  | N | N |  | 549 | 0 | Present | 9:09 | - |
| Columns X to AB are formulas. THIS CLIENT COUNTS GATE-TO-GATE HOURS: the meal break is recorded and reported but not deducted, which is what makes Ravi Kulkarni's 08 September day 19h20m and his overtime 7h20m, exactly as the requirement states. Gate-pass minutes ARE deducted and then credited back when approved, so an approved pass leaves net hours unchanged and an unapproved one does not. Status reads the thresholds from sheet 08 by INDEX/MATCH, so editing a threshold there re-derives every row here. Reconcile the product's output against column Z. ADDED v1.1: AD-00211 to AD-00225 for E1021 Rekha Deshpande, a Manager at grade rank 55. Five lates beyond grace in one month, of which the fourth and fifth would be half days for anyone below rank 50 — column T stays N and the status stays Present, which is the exemption half of point 12. Compare her 09 September against E1019 on 10 September, same month, same rule, opposite outcome. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `22_Gate_Pass` (6 rows)

| Gate pass ID | Employee code | Name | Date | From | To | Minutes | Type | Reason | Status | Approver | Minutes used this month | Instances this month | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GP-2026-0141 | E1023 | Kavya Venkatesh | 2026-09-04 | 12:00 | 14:00 | 120 | Personal | Bank work | Approved | E1024 | 120 | 1 | Point 11 |
| GP-2026-0155 | E1023 | Kavya Venkatesh | 2026-09-11 | 11:30 | 13:30 | 120 | Personal | School admission | Approved | E1024 | 240 | 2 | Point 11 |
| GP-2026-0163 | E1023 | Kavya Venkatesh | 2026-09-24 | 15:00 | 17:00 | 120 | Personal | Personal errand | Rejected — monthly ceiling of 240 minutes already used and 2 instances taken | E1024 | 240 | 2 | Point 11 |
| GP-2026-0148 | E1026 | Manjunath Poojary | 2026-09-07 | 22:00 | 23:00 | 60 | Official | Vendor pickup at gate | Approved | E1027 | 0 | 0 | Official gate pass does not consume the personal ceiling |
| GP-2026-0152 | E1044 | Rahul Gaikwad | 2026-09-09 | 10:00 | 14:00 | 240 | Personal | Medical appointment | Approved | E1040 | 240 | 1 | Point 11 — the whole ceiling taken as one 4-hour pass |
| Four hours a month, as one 4-hour pass or two of two hours, maximum two instances. Approved personal minutes are credited back to work hours — see column O of sheet 21. Official gate passes are tracked separately and do not consume the ceiling. |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `23_Overtime_Register` (8 rows)

| OT record | Employee code | Name | Date | Day type | OT minutes | OT hours | Rate multiplier | Eligibility basis | Approved by | Approved on | Pay in run | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OT-2026-0912 | E1018 | Ravi Kulkarni | 2026-09-08 | Working | 440 | 7:20 | 2 | All | E1017 | 2026-09-09 | PR-2026-09-02 | Points 1, 10 |
| OT-2026-0918 | E1026 | Manjunath Poojary | 2026-09-05 | Working | 12 | 0:12 | 2 | All | E1027 | 2026-09-06 | PR-2026-09-02 |  |
| OT-2026-0931 | E1034 | Imran Shaikh | 2026-09-06 | Weekly Off | 728 | 12:08 | 2 | RestDayHolidayOnly | E1021 | 2026-09-07 | PR-2026-09-02 | Point 4 |
| OT-2026-0932 | E1034 | Imran Shaikh | 2026-09-04 | Working | 0 | - | 2 | RestDayHolidayOnly | Not raised |  |  | Point 4 — 12h+ span on a working day, no OT payable |
| OT-2026-0940 | E1036 | Lakshmi Rao | 2026-09-06 | Working | 0 | - | 2 | RestDayHolidayOnly | Not raised |  |  | Points 3, 4 — helper has no rest day, so Sunday is a working day and no OT arises |
| OT-2026-0947 | E1028 | Yashoda Rani | 2026-09-06 | Weekly Off | 0 | - | Comp-off instead | All | E1021 | 2026-09-07 | Not paid | Point 6 — comp-off credited rather than OT paid |
| OT-2026-0955 | E1032 | Shivanna Muniyappa | 2026-09-13 | Working | 12 | 0:12 | 2 | All | E1017 | 2026-09-14 | PR-2026-09-02 | Point 2 — daily-wage worker, Sunday is an ordinary working day |
| Every minute figure here reconciles to column Y of sheet 21 — check them against each other before the demo. Overtime is computed with the September cycle but disbursed in run PR-2026-09-02, released on 07 October. Compare the Imran Shaikh rows: the same span on a working day and a rest day. |  |  |  |  |  |  |  |  |  |  |  |  |

### `41_Grace_Late_Policy` (3 rows)

| Policy code | Applies to | Grace minutes on arrival | Grace minutes on departure | Lates allowed per month | Consequence beyond the allowance | Counter reset basis | Exempt from grade rank | Exempt designations | Effective from | Demo record | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GP-01 | All locations, all shift groups | 15 | 15 | 3 | Half day | Calendar month | 50 | DES-01 to DES-07 and DES-20 — Assistant Manager and above | 2026-04-01 | E1019 Sneha Nair — lates on 01, 03, 07 Sep within allowance; 10 and 14 Sep become half days | Point 12 |
| GP-01-EX | Grade rank 50 and above | 15 | 15 | 3 | No action | Calendar month | 50 | Same list — the exemption is the same rank, expressed as a separate row so it is visible | 2026-04-01 | E1021 Rekha Deshpande — five lates in September, every day still Present | Point 12 |
| ADDED v1.1 for form F-ATT-06. Four numbers the client stated as policy — 15, 15, 3 and half day — now sit in a configuration row rather than in the attendance engine. The counter reset basis is the subject of open question Q-12: calendar month and payroll month give different answers whenever the payroll cycle is not the calendar month, and this client runs 01 to end of month, so today they agree. Say so on screen rather than leaving it to be discovered later. |  |  |  |  |  |  |  |  |  |  |  |

### `42_Night_Extension_Rule` (3 rows)

| Rule code | Applies to shift | Previous session ends after | Permitted arrival until | Minimum departure to qualify | Resulting day status | Late mark suppressed | Grace deduction suppressed | Maximum uses per month | Effective from | Demo record | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| NE-01 | SH-A | 03:00 | 09:30 | 20:00 | Present | Y | Y |  | 2026-04-01 | E1018 Ravi Kulkarni — out 03:20 on the night of 08 Sep, in 09:25 on 09 Sep, out 20:10. Span is 10h45m, below the 11h30m half-day threshold, and the day still pays as a full day. | Point 12 |
| NE-02 | SH-B | 03:00 | 09:30 | 20:00 | Present | Y | Y |  | 2026-04-01 | Seeded for the night shift so the rule is not single-shift. No demo record. | Point 12 |
| ADDED v1.1 for form F-SHF-03. This is the rule with the least support in the source: the client said 03:00 or 04:00 and 09:00 or 09:30 without settling either, and gave no frequency limit. Maximum uses per month is deliberately blank, which means unlimited — open question Q-11. Leave it blank on screen and ask the question in the room; an uncapped relief rule is how late arrival gets normalised. |  |  |  |  |  |  |  |  |  |  |  |

### `49_Break_Register` (5 rows)

| Break ID | Employee code | Name | Attendance date | Session | Break seq | Break start | Break end | Break minutes | Break type | Derived from | Deducted from net hours | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BR-0001 | E1018 | Ravi Kulkarni | 2026-09-08 | 1 | 1 | 20:30 | 21:15 | 45 | Meal | Punch gap — OUT to next IN | N | Point 1 — this single row is the requirement. The client asked for the dinner break to be reported separately, and gate-to-gate hours stay 19h20m because it is not deducted. |
| BR-0002 | E1023 | Kavya Venkatesh | 2026-09-04 | 1 | 1 | 12:00 | 14:00 | 120 | Gate pass | Punch gap — OUT to next IN, overlapping approved pass GP-2026-0141 | N — deducted then credited back | Point 11 |
| BR-0003 | E1023 | Kavya Venkatesh | 2026-09-11 | 1 | 1 | 11:30 | 13:30 | 120 | Gate pass | Punch gap — OUT to next IN, overlapping approved pass GP-2026-0155 | N — deducted then credited back | Point 11 |
| BR-0004 | E1018 | Ravi Kulkarni | 2026-09-01 | 1 |  |  |  | 60 | Shift break | Shift master SH-A — scheduled, not punched | N | The 60 minutes shown in column N of sheet 21 on an ordinary day. Every SH-A and SH-B day carries this; SH-C and SH-D carry 45 and SH-F carries 30. |
| ADDED v1.1 for form F-ATT-03 and report RP-01. Rule RL-03 defines a break as the gap between an OUT and the following IN inside a session, so only the first three rows are breaks in that sense — BR-0004 is the scheduled shift break and is shown here only to explain where the 60 in sheet 21 comes from. Keep the two kinds visibly separate on the register; a client who sees one 60-minute row per person per day will reasonably assume the system is inventing breaks. Break type is configurable (EN_BREAK_TYPE) and a break overlapping an approved gate pass classifies itself. |  |  |  |  |  |  |  |  |  |  |  |  |

### `50_Attendance_Regularisation` (6 rows)

| Request | Employee code | Name | Attendance date | Original status | Requested status | Reason | Evidence | Raised on | Raised by | Approver | Approval status | Effect once approved | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RG-2026-0211 | E1022 | Mohan Joseph | 2026-09-09 | Absent | Half day | Left at 13:15 on medical grounds without applying leave | Dispensary slip attached | 2026-09-10 | E1022 | E1021 | Pending — supervisor | Day status becomes Half day; the LOP for the second half stands | Point 12 |
| RG-2026-0214 | E1043 | Neha Mishra | 2026-09-14 | On leave | Present | Returned early from LV-2026-0774 and reported for work | System generated by the early-return action | 2026-09-14 | System | E1006 | Approved 2026-09-14 | Attendance corrected to Present for 14, 15 and 16 Sep and three EL days credited back in the same commit | Point 5 |
| RG-2026-0217 | E1026 | Manjunath Poojary | 2026-09-05 | Present | Present | Out punch missed at the gate on the night shift; security register confirms 08:12 | Gate register extract, night of 05 Sep | 2026-09-06 | E1026 | E1027 | Approved 2026-09-07 | Last out set to 08:12, gross recomputed, the 12-minute OT line on OT-2026-0918 follows from it | Point 1 |
| RG-2026-0220 | E1032 | Shivanna Muniyappa | 2026-09-13 | Present | Weekly Off | Worker asked for Sunday to be treated as a rest day |  | 2026-09-14 | E1032 | E1017 | Rejected 2026-09-14 | No change. His worker class carries no rest day, so a regularisation cannot create one — the entitlement is a policy question, not an attendance correction. | Point 2 |
| RG-2026-0222 | E1056 | Anand Krishnan | 2026-09-11 | Present | Present | In punch recorded on the wrong device after a reader fault | Device fault log BIO-CHN-01 | 2026-09-12 | E1056 | E1055 | Approved 2026-09-12 | Punch reassigned. Note that E1055 can approve this while still being unable to see any salary field on the same record. | Points 8, 12 |
| ADDED v1.1 for form F-ATT-04 and screen FRM-TIM-05. Two rows earn their place beyond filling a gap. RG-2026-0214 is the attendance half of demo point 5 — the early return has to write an attendance correction and a ledger credit in one commit, which is what workflow W-02 requires. RG-2026-0220 is the one to open when the client asks whether a supervisor can simply regularise around the rest-day rule: the refusal is the control working. |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `51_Attendance_Exceptions` (7 rows)

| Exception | Employee code | Name | Attendance date | Exception type | Detail | Detected on | Severity | Resolution path | Resolved on | Status | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EX-2026-0341 | E1026 | Manjunath Poojary | 2026-09-05 | Missing out punch | IN at 20:02 with no matching OUT before the next session opened | 2026-09-06 | Blocks payroll | Regularisation RG-2026-0217 | 2026-09-07 | Closed | Point 1 |
| EX-2026-0352 | E1022 | Mohan Joseph | 2026-09-09 | Short day below the absent threshold | Net 5h05m against a 6h30m absent threshold on a 12-hour shift | 2026-09-10 | Blocks payroll | Regularisation RG-2026-0211 raised, awaiting supervisor |  | Open | Point 12 |
| EX-2026-0358 | E1020 | Arjun Bhat | 2026-09-04 | Shift differs from roster | Rostered SH-A, in-punch 20:05 falls inside the SH-B detection window | 2026-09-05 | Informational | Auto-resolved — detected shift adopted and the override recorded | 2026-09-05 | Closed | Point 13 |
| EX-2026-0361 | E1018 | Ravi Kulkarni | 2026-09-08 | Session crosses the date boundary | Last OUT at 03:20 on 09 Sep against an attendance date of 08 Sep | 2026-09-09 | Informational | Auto-resolved — session attributed to the date of the first IN per rule RL-01 | 2026-09-09 | Closed | Point 1 |
| EX-2026-0366 | E1036 | Lakshmi Rao | 2026-09-07 | Vendor claim without attendance | Day claimed on invoice INV-VN01-2609 with no punch recorded | 2026-09-30 | Blocks vendor payment | Held on the invoice reconciliation, query raised with VN-01 |  | Open | Point 3 |
| EX-2026-0369 | E1063 | Revathi Natarajan | 2026-09-08 | No punch and no leave | Apprentice absent with nothing applied | 2026-09-09 | Blocks payroll | LOP raised pending supervisor confirmation |  | Open |  |
| ADDED v1.1 for form FRM-TIM-08. The distinction that matters on screen is severity: two of these resolve themselves and are informational, three block the payroll run, and one blocks a vendor payment rather than an employee payment. A queue that treats all six the same is the reason exception handling gets abandoned in month three. Run this screen immediately before the payroll run in the demo — that is the order it is used in. |  |  |  |  |  |  |  |  |  |  |  |

### `52_Shift_Roster` (9 rows)

| Roster | Employee code | Name | Org unit | From date | To date | Rostered shift | Rotation pattern | Published on | Published by | Overridden by detection | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RS-2026-W36-01 | E1018 | Ravi Kulkarni | OU-111 | 2026-09-01 | 2026-09-15 | SH-A | Fixed A shift | 2026-08-25 | E1017 | No |  |
| RS-2026-W36-02 | E1019 | Sneha Nair | OU-111 | 2026-09-01 | 2026-09-15 | SH-A | Fixed A shift | 2026-08-25 | E1017 | No |  |
| RS-2026-W36-03 | E1020 | Arjun Bhat | OU-112 | 2026-09-01 | 2026-09-15 | SH-A | Fixed A shift, covering B on request | 2026-08-25 | E1021 | Yes — 04 and 11 Sep detected as SH-B | Point 13 — the roster says A and the punch says B; the detected shift governs and the difference is recorded |
| RS-2026-W36-04 | E1026 | Manjunath Poojary | OU-114 | 2026-09-01 | 2026-09-15 | SH-B | Fixed B shift | 2026-08-25 | E1027 | No |  |
| RS-2026-W36-05 | E1045 | Sunita Bhosale | OU-113 | 2026-09-01 | 2026-09-15 | SH-D | Fixed D shift, 17:00 to 03:00 | 2026-08-25 | E1040 | No | Every day of hers crosses midnight, which is the ordinary case rule RL-01 has to handle, not the exception |
| RS-2026-W36-06 | E1021 | Rekha Deshpande | OU-112 | 2026-09-01 | 2026-09-15 | SH-E | General shift | 2026-08-25 | E1016 | No | Point 12 — grade-exempt supervisor on the general shift |
| RS-2026-W36-07 | E1034 | Imran Shaikh | OU-112 | 2026-09-01 | 2026-09-15 | SH-A | Fixed A shift | 2026-08-25 | E1021 | No | Points 3, 4 — same roster line as E1036, different rest-day answer |
| RS-2026-W36-08 | E1036 | Lakshmi Rao | OU-121 | 2026-09-01 | 2026-09-15 | SH-A | Fixed A shift, no rest day | 2026-08-25 | E1037 | No | Point 3 |
| ADDED v1.1 for form FRM-TIM-02. v1.0 recorded the rostered and the applied shift in sheet 21 but never the roster itself, so auto-detection had nothing to override. Open this alongside E1020's 04 September row: the roster is unchanged and still says SH-A, the day was processed on SH-B, and both facts are visible at once. A product that silently rewrites the roster loses the audit trail that makes the override defensible. |  |  |  |  |  |  |  |  |  |  |  |

## Approval & Sign-off

| Role | Name | Date | Decision | Conditions / comments |
| :--- | :--- | :--- | :--- | :--- |
| Author | Dhanraj Dadhich | 2026-11-05 | Submitted | |
| Peer review moderator | *pending* | | | PR-xxxx |
| PQA (process compliance) | *pending* | | | |
| Approval authority (DOC-01 §7) | *pending* | | | |

## Measurement Data Captured

| Measure | Value | Unit | Notes |
| :--- | :--- | :--- | :--- |
| Size | 711 | specified items (table rows) | Counted automatically at generation |
| Authoring effort | *to be recorded* | person-hours | |
| Review effort (preparation + meeting) | *pending review* | person-hours | From PR-xxxx |
| Rework effort | *pending review* | person-hours | |
| Review rate | *pending review* | items / hour | Compare with PPB control limits |
| Requirement volatility (changes since baseline) | 0 | CRs touching this artefact | Not yet baselined (CM-03) |

**Defects found, by detection phase and severity**

| Detection phase | Major | Minor | Editorial | Injected in phase (major) |
| :--- | :--- | :--- | :--- | :--- |
| Author self-check | 0 | 0 | 0 | — |
| Peer review | *pending* | | | |
| Design / build | | | | |
| System / integration test | | | | |
| UAT | | | | |
| Production (escaped) | | | | each escaped major opens a CAR record (CAR-01) |

Within control limits of the review-rate PPB? *To be assessed at peer review.*

## Revision History

| Version | Date | Author | Change summary | CR ref | Approved by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-11-05 | Dhanraj Dadhich | Consolidated release | CR-0001 | *pending* |
