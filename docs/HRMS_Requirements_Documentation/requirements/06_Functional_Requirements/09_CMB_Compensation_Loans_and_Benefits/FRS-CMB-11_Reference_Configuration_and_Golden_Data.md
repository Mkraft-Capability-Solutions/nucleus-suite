<p align="right">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/MultipliersKraftLogoDark.png">
  <img src="../../assets/MultipliersKraftLogoLight.png" alt="MultipliersKraft" height="56">
</picture>
</p>

# FRS-CMB-11 — Compensation, Loans & Benefits — Reference Configuration and Golden Data

| Attribute | Value |
| :--- | :--- |
| Document ID | FRS-CMB-11 |
| Title | Compensation, Loans & Benefits — Reference Configuration and Golden Data |
| Product | Nucleus Suite (Nucleus HRMS Suite) |
| Version | 1.0.0 |
| Status | Issued for approval |
| Owner (role) | Domain Product Owner — Compensation, Loans & Benefits |
| Author | Dhanraj Dadhich |
| Reviewed by | *pending* |
| Approved by | Product Council — *pending* |
| Date | 2026-11-05 |
| Classification | Internal |
| CMMI practice areas | TS, VV |
| Related documents | FRS-CMB-00, FRS-CMB-01, FRS-CMB-02, FRS-CMB-03, FRS-CMB-04, FRS-CMB-05, FRS-CMB-06, FRS-CMB-07, FRS-CMB-08, FRS-CMB-09, FRS-CMB-10, FRS-CMB-11, FRS-CMB-12, FRS-CMB-13, BRS-01, SRS-01, REQ-01, REQ-02 |
| Quality & process-performance objectives | QPPO-05 (effective requirements reviews), QPPO-01 (escaped defects) — MPM-01 |
| Process performance baseline used | PPB-01 (review defect density), PPB-02 (review rate) — MPM-01 |
| Peer review record | *pending* (PR-xxxx, QA-02) |
| Tailoring record | none |
| Traceability anchor | BG-04, BG-05 · R-10 · processes CMB-01–CMB-06 |
| Source of record | Nucleus HR Demo Points Build Sheet v1.0 — sheet(s) 09_Configuration_Register<br>Nucleus HRMS Demo Dataset v1.1 — sheet(s) 13_Salary_Structure, 24_Loans, 25_Loan_Guarantors |

> **Source of record.** Requirements in this document are taken from the source workbook(s) named above and keep their workbook IDs, which are never renumbered. Changes are made through a change request (CM-02) against the source workbook. Sections marked **Authored** are original additions that are not present in the source workbooks.

Pilot client: **Vindhya Precision Industries Pvt Ltd** (fictional). Identifiers are format-valid dummies; bank accounts carry only the last four digits. Values are engineered so computed results reconcile exactly.

## 1. Configuration register (configuration, not code)

| Config item | Module | Where it is set | Default | Set by | Requirement | Why it must not be code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Eligible multiple | LON | F-LON-01 — Loan Application | 4.00 | All roles | R-10 | Yes — the multiples are policy values |
| Guarantor 3 | LON | F-LON-01 — Loan Application | — | All roles | R-10 | Yes |
| Special terms applied | LON | F-LON-01 — Loan Application | N | HR roles only | R-10 | Yes |
| Guarantee status | LON | F-LON-02 — Guarantor Register | Active | HR roles only | R-10 | Yes — value set configurable per tenant |

## 2. Reference and golden data

### `13_Salary_Structure` (70 rows)

| Employee code | Name | Worker class | Wage type | Basic (INR) | DA (INR) | HRA (INR) | Conveyance (INR) | Special allowance (INR) | Daily rate (INR) | Monthly retainer (INR) | Monthly gross (INR) | Wage base — Basic+DA (INR) | Excluded components (INR) | Excluded as % of gross | 50% floor add-back (INR) | Statutory wage base (INR) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E1001 | Arvind Raghunathan | WC-PERM | Monthly | 182000 | 21840 | 72800 | 1600 | 50960 |  |  | 329200 | 203840 | 125360 | 0.380801944106926 | 0 | 203840 |
| E1002 | Meenakshi Sundaram | WC-PERM | Monthly | 182250 | 21870 | 72900 | 1600 | 51030 |  |  | 329650 | 204120 | 125530 | 0.380797815865312 | 0 | 204120 |
| E1003 | Farhan Qureshi | WC-PERM | Monthly | 182500 | 21900 | 73000 | 1600 | 51100 |  |  | 330100 | 204400 | 125700 | 0.380793698879128 | 0 | 204400 |
| E1004 | Ritu Balachandran | WC-PERM | Monthly | 108750 | 13050 | 43500 | 1600 | 30450 |  |  | 197350 | 121800 | 75550 | 0.382822396757031 | 0 | 121800 |
| E1005 | Prakash Venugopal | WC-PERM | Monthly | 109000 | 13080 | 43600 | 1600 | 30520 |  |  | 197800 | 122080 | 75720 | 0.382810920121335 | 0 | 122080 |
| E1006 | Anita Mathew | WC-PERM | Monthly | 62250 | 7470 | 24900 | 1600 | 17430 |  |  | 113650 | 69720 | 43930 | 0.386537615486142 | 0 | 69720 |
| E1007 | Deepak Sarangi | WC-PERM | Monthly | 62500 | 7500 | 25000 | 1600 | 17500 |  |  | 114100 | 70000 | 44100 | 0.386503067484663 | 0 | 70000 |
| E1008 | Shalini Krishnamurthy | WC-PERM | Monthly | 21500 | 2580 | 8600 | 1600 | 6020 |  |  | 40300 | 24080 | 16220 | 0.402481389578164 | 0 | 24080 |
| E1009 | Vikram Chauhan | WC-PERM | Monthly | 37750 | 4530 | 15100 | 1600 | 10570 |  |  | 69550 | 42280 | 27270 | 0.392092020129403 | 0 | 42280 |
| E1010 | Nandita Bose | WC-PERM | Monthly | 61500 | 7380 | 24600 | 1600 | 17220 |  |  | 112300 | 68880 | 43420 | 0.386642920747996 | 0 | 68880 |
| E1011 | Rohit Agarwal | WC-PERM | Monthly | 22250 | 2670 | 8900 | 1600 | 6230 |  |  | 41650 | 24920 | 16730 | 0.401680672268908 | 0 | 24920 |
| E1012 | Sameer Kulkarni | WC-PERM | Monthly | 62000 | 7440 | 24800 | 1600 | 17360 |  |  | 113200 | 69440 | 43760 | 0.386572438162544 | 0 | 69440 |
| E1013 | Tanvi Deshmukh | WC-PERM | Monthly | 38750 | 4650 | 15500 | 1600 | 10850 |  |  | 71350 | 43400 | 27950 | 0.391730903994394 | 0 | 43400 |
| E1014 | Harish Nambiar | WC-PERM | Monthly | 62500 | 7500 | 25000 | 1600 | 84375 |  |  | 180975 | 70000 | 110975 | 0.613206243956348 | 20487.5 | 90487.5 |
| E1015 | Pooja Trivedi | WC-PERM | Monthly | 61000 | 7320 | 24400 | 1600 | 17080 |  |  | 111400 | 68320 | 43080 | 0.386714542190305 | 0 | 68320 |
| E1016 | Basavaraj Hiremath | WC-PERM | Monthly | 108250 | 12990 | 43300 | 1600 | 30310 |  |  | 196450 | 121240 | 75210 | 0.38284550776279 | 0 | 121240 |
| E1017 | Nikhil Iyer | WC-PERM | Monthly | 61500 | 7380 | 24600 | 1600 | 17220 |  |  | 112300 | 68880 | 43420 | 0.386642920747996 | 0 | 68880 |
| E1018 | Ravi Kulkarni | WC-PERM | Monthly | 38250 | 4590 | 15300 | 1600 | 10710 |  |  | 70450 | 42840 | 27610 | 0.391909155429383 | 0 | 42840 |
| E1019 | Sneha Nair | WC-PERM | Monthly | 38500 | 4620 | 15400 | 1600 | 10780 |  |  | 70900 | 43120 | 27780 | 0.391819464033851 | 0 | 43120 |
| E1020 | Arjun Bhat | WC-PERM | Monthly | 38750 | 4650 | 15500 | 1600 | 10850 |  |  | 71350 | 43400 | 27950 | 0.391730903994394 | 0 | 43400 |
| E1021 | Rekha Deshpande | WC-PERM | Monthly | 62500 | 7500 | 25000 | 1600 | 17500 |  |  | 114100 | 70000 | 44100 | 0.386503067484663 | 0 | 70000 |
| E1022 | Mohan Joseph | WC-PERM | Monthly | 21500 | 2580 | 8600 | 1600 | 6020 |  |  | 40300 | 24080 | 16220 | 0.402481389578164 | 0 | 24080 |
| E1023 | Kavya Venkatesh | WC-PERM | Monthly | 21750 | 2610 | 8700 | 1600 | 6090 |  |  | 40750 | 24360 | 16390 | 0.402208588957055 | 0 | 24360 |
| E1024 | Srinivas Achar | WC-PERM | Monthly | 61500 | 7380 | 24600 | 1600 | 17220 |  |  | 112300 | 68880 | 43420 | 0.386642920747996 | 0 | 68880 |
| E1025 | Lakshmi Gowda | WC-PERM | Monthly | 22250 | 2670 | 8900 | 1600 | 6230 |  |  | 41650 | 24920 | 16730 | 0.401680672268908 | 0 | 24920 |
| E1026 | Manjunath Poojary | WC-PERM | Monthly | 22500 | 2700 | 9000 | 1600 | 6300 |  |  | 42100 | 25200 | 16900 | 0.401425178147268 | 0 | 25200 |
| E1027 | Girish Deshpande | WC-PERM | Monthly | 62250 | 7470 | 24900 | 1600 | 17430 |  |  | 113650 | 69720 | 43930 | 0.386537615486142 | 0 | 69720 |
| E1028 | Yashoda Rani | WC-PERM | Monthly | 23000 | 2760 | 9200 | 1600 | 6440 |  |  | 43000 | 25760 | 17240 | 0.40093023255814 | 0 | 25760 |
| E1029 | Prashant Salian | WC-PERM | Monthly | 21500 | 2580 | 8600 | 1600 | 6020 |  |  | 40300 | 24080 | 16220 | 0.402481389578164 | 0 | 24080 |
| E1030 | Chetan Bhandary | WC-TRN | Monthly | 13750 | 1650 | 5500 | 1600 | 3850 |  |  | 26350 | 15400 | 10950 | 0.415559772296015 | 0 | 15400 |
| E1031 | Divya Hegde | WC-TRN | Monthly | 14000 | 1680 | 5600 | 1600 | 3920 |  |  | 26800 | 15680 | 11120 | 0.414925373134328 | 0 | 15680 |
| E1032 | Shivanna Muniyappa | WC-CONT | Daily |  |  |  |  |  | 650 |  |  |  |  |  |  |  |
| E1033 | Ratnamma Devaraju | WC-CONT | Daily |  |  |  |  |  | 665 |  |  |  |  |  |  |  |
| E1034 | Imran Shaikh | WC-3PE | Monthly | 22750 | 2730 | 9100 | 1600 | 6370 |  |  | 42550 | 25480 | 17070 | 0.40117508813161 | 0 | 25480 |
| E1035 | Ashok Naik | WC-3PE | Monthly | 23000 | 2760 | 9200 | 1600 | 6440 |  |  | 43000 | 25760 | 17240 | 0.40093023255814 | 0 | 25760 |
| E1036 | Lakshmi Rao | WC-3PH | Daily |  |  |  |  |  | 635 |  |  |  |  |  |  |  |
| E1037 | Venkatesh Murthy | WC-PERM | Monthly | 21750 | 2610 | 8700 | 1600 | 6090 |  |  | 40750 | 24360 | 16390 | 0.402208588957055 | 0 | 24360 |
| E1038 | Parvathi Bai | WC-3PH | Daily |  |  |  |  |  | 665 |  |  |  |  |  |  |  |
| E1039 | Sanjay Pawar | WC-PERM | Monthly | 108750 | 13050 | 43500 | 1600 | 30450 |  |  | 197350 | 121800 | 75550 | 0.382822396757031 | 0 | 121800 |
| E1040 | Aditi Joshi | WC-PERM | Monthly | 62000 | 7440 | 24800 | 1600 | 17360 |  |  | 113200 | 69440 | 43760 | 0.386572438162544 | 0 | 69440 |
| E1041 | Mahesh Shinde | WC-PERM | Monthly | 38750 | 4650 | 15500 | 1600 | 10850 |  |  | 71350 | 43400 | 27950 | 0.391730903994394 | 0 | 43400 |
| E1042 | Swapnil Kadam | WC-PERM | Monthly | 39000 | 4680 | 15600 | 1600 | 10920 |  |  | 71800 | 43680 | 28120 | 0.391643454038997 | 0 | 43680 |
| E1043 | Neha Mishra | WC-PERM | Monthly | 21500 | 2580 | 8600 | 1600 | 6020 |  |  | 40300 | 24080 | 16220 | 0.402481389578164 | 0 | 24080 |
| E1044 | Rahul Gaikwad | WC-PERM | Monthly | 21750 | 2610 | 8700 | 1600 | 6090 |  |  | 40750 | 24360 | 16390 | 0.402208588957055 | 0 | 24360 |
| E1045 | Sunita Bhosale | WC-PERM | Monthly | 22000 | 2640 | 8800 | 1600 | 6160 |  |  | 41200 | 24640 | 16560 | 0.401941747572816 | 0 | 24640 |
| E1046 | Dattatray More | WC-CONT | Daily |  |  |  |  |  | 635 |  |  |  |  |  |  |  |
| E1047 | Koteswara Rao | WC-PERM | Monthly | 109000 | 13080 | 43600 | 1600 | 30520 |  |  | 197800 | 122080 | 75720 | 0.382810920121335 | 0 | 122080 |
| E1048 | Sirisha Yadav | WC-PERM | Monthly | 62250 | 7470 | 24900 | 1600 | 17430 |  |  | 113650 | 69720 | 43930 | 0.386537615486142 | 0 | 69720 |
| E1049 | Naveen Bandaru | WC-PERM | Monthly | 39000 | 4680 | 15600 | 1600 | 52650 |  |  | 113530 | 43680 | 69850 | 0.615255879503215 | 13085 | 56765 |
| E1050 | Suresh Pillai | WC-PERM | Monthly | 37500 | 4500 | 15000 | 1600 | 10500 |  |  | 69100 | 42000 | 27100 | 0.392185238784371 | 0 | 42000 |
| E1051 | Haritha Reddy | WC-PERM | Monthly | 37750 | 4530 | 15100 | 1600 | 10570 |  |  | 69550 | 42280 | 27270 | 0.392092020129403 | 0 | 42280 |
| E1052 | Anjaneyulu Gadde | WC-PERM | Monthly | 22000 | 2640 | 8800 | 1600 | 6160 |  |  | 41200 | 24640 | 16560 | 0.401941747572816 | 0 | 24640 |
| E1053 | Padmaja Cheruku | WC-3PH | Daily |  |  |  |  |  | 665 |  |  |  |  |  |  |  |
| E1054 | Selvaraj Murugan | WC-PERM | Monthly | 109000 | 13080 | 43600 | 1600 | 30520 |  |  | 197800 | 122080 | 75720 | 0.382810920121335 | 0 | 122080 |
| E1055 | Kalaivani Subramani | WC-PERM | Monthly | 62250 | 7470 | 24900 | 1600 | 17430 |  |  | 113650 | 69720 | 43930 | 0.386537615486142 | 0 | 69720 |
| E1056 | Anand Krishnan | WC-PERM | Monthly | 39000 | 4680 | 15600 | 1600 | 10920 |  |  | 71800 | 43680 | 28120 | 0.391643454038997 | 0 | 43680 |
| E1057 | Bhuvaneswari Raman | WC-PERM | Monthly | 21500 | 2580 | 8600 | 1600 | 6020 |  |  | 40300 | 24080 | 16220 | 0.402481389578164 | 0 | 24080 |
| E1058 | Karthik Chidambaram | WC-PERM | Monthly | 37750 | 4530 | 15100 | 1600 | 10570 |  |  | 69550 | 42280 | 27270 | 0.392092020129403 | 0 | 42280 |
| E1059 | Vetrivel Pandian | WC-PERM | Monthly | 22000 | 2640 | 8800 | 1600 | 6160 |  |  | 41200 | 24640 | 16560 | 0.401941747572816 | 0 | 24640 |
| E1060 | Jayanthi Elangovan | WC-PERM | Monthly | 22250 | 2670 | 8900 | 1600 | 6230 |  |  | 41650 | 24920 | 16730 | 0.401680672268908 | 0 | 24920 |
| E1061 | Murugesan Palani | WC-CONT | Daily |  |  |  |  |  | 635 |  |  |  |  |  |  |  |
| E1062 | Saravanan Thangavel | WC-3PE | Monthly | 22750 | 2730 | 9100 | 1600 | 6370 |  |  | 42550 | 25480 | 17070 | 0.40117508813161 | 0 | 25480 |
| E1063 | Revathi Natarajan | WC-APP | Monthly | 15000 | 1800 | 6000 | 1600 | 4200 |  |  | 28600 | 16800 | 11800 | 0.412587412587413 | 0 | 16800 |
| E1064 | Gopinath Sekar | WC-CONS | Retainer |  |  |  |  |  |  | 165000 |  |  |  |  |  |  |
| E1065 | Ishita Chatterjee | WC-PERM | Monthly | 37750 | 4530 | 15100 | 1600 | 10570 |  |  | 69550 | 42280 | 27270 | 0.392092020129403 | 0 | 42280 |
| E1066 | Abhinav Rastogi | WC-PERM | Monthly | 22000 | 2640 | 8800 | 1600 | 6160 |  |  | 41200 | 24640 | 16560 | 0.401941747572816 | 0 | 24640 |
| E1067 | Ankita Bhargava | WC-PERM | Monthly | 38250 | 4590 | 15300 | 1600 | 10710 |  |  | 70450 | 42840 | 27610 | 0.391909155429383 | 0 | 42840 |
| E1068 | Dinesh Vaidya | WC-PERM | Monthly | 38500 | 4620 | 15400 | 1600 | 10780 |  |  | 70900 | 43120 | 27780 | 0.391819464033851 | 0 | 43120 |
| E1069 | Meera Prabhu | WC-PERM | Monthly | 21750 | 2610 | 8700 | 1600 | 6090 |  |  | 40750 | 24360 | 16390 | 0.402208588957055 | 0 | 24360 |
| Columns L to Q are formulas implementing the Code on Wages 50% floor test from the blueprint. E1014 and E1049 are structured so that excluded components exceed 50% of gross and an add-back is required — use these two to demo the wage-base node and the structure simulator. ADDED v1.1: E1069 Meera Prabhu, carrying the same formulas as every other row. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `24_Loans` (8 rows)

| Loan / application ID | Employee code | Name | Purpose | Principal (INR) | Sanctioned on | Tenure (months) | Instalment (INR) | Outstanding (INR) | Status | Sanctioned by | Special terms | Eligibility basis | Demo point / reason | Basic (INR) | Ceiling multiple | Eligibility ceiling (INR) | Within ceiling? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LN-2026-0041 | E1044 | Rahul Gaikwad | Personal loan | 84000 | 2026-03-15 | 24 | 3500 | 52500 | Active | E1003 | N | 4x basic | Point 9 — active loan; his two guarantors are now blocked | 21750 | 4 | 87000 | Yes |
| LN-2026-0009 | E1056 | Anand Krishnan | Housing top-up | 228000 | 2026-01-20 | 36 | 6340 | 177520 | Active | E1003 | N | 6x basic — 8 years 8 months service | Point 9 — the >5 year ceiling | 39000 | 6 | 234000 | Yes |
| LN-2025-0112 | E1050 | Suresh Pillai | Personal loan | 144000 | 2025-04-10 | 24 | 6000 | 0 | Closed | E1003 | N | 4x basic | Point 9 — closed 30 Jun 2026; guarantors released, he is eligible again | 37500 | 4 | 150000 | Yes |
| LN-2026-0012 | E1022 | Mohan Joseph | Medical — special terms | 150000 | 2026-02-08 | 36 | 4170 | 116760 | Active | E1001 | Y | Special terms — 150,000 against an 86,000 ceiling, director approved | Point 9 — override recorded with approver and the rules waived | 21500 | 4 | 86000 | No — override required |
| LN-APP-2026-0014 | E1041 | Mahesh Shinde | Personal loan | 120000 | 2026-09-08 |  |  |  | Rejected | E1003 | N | Not applicable | Point 9 — within his 155,000 ceiling, but rejected because he is an active guarantor on LN-2026-0041 | 38750 | 4 | 155000 | Yes |
| LN-APP-2026-0019 | E1044 | Rahul Gaikwad | Salary advance | 40000 | 2026-09-10 |  |  |  | Rejected | E1003 | N | Not applicable | Point 9 — rejected: an outstanding loan bars a salary advance | 21750 | 4 | 87000 | Yes |
| LN-APP-2026-0022 | E1050 | Suresh Pillai | Personal loan | 140000 | 2026-09-12 |  |  |  | Approved, pending disbursement | E1003 | N | 4x basic | Point 9 — eligible again because LN-2025-0112 closed and released him | 37500 | 4 | 150000 | Yes |
| Columns O to R are formulas reading basic pay from sheet 13. The ceiling is 4x monthly basic, rising to 6x after five years of service. Only LN-2026-0012 breaches its ceiling, and that is the director-approved special-terms case — every other row is within limit and is blocked, or allowed, on a rule other than amount. Eligibility is a service method in the product, not a form check — the loan screen, the guarantor lock and the payroll deduction node must all read the same answer. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### `25_Loan_Guarantors` (10 rows)

| Loan ID | Guarantor code | Guarantor name | Mandatory | Accepted on | Released on | Guarantor currently blocked | Demo point |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LN-2026-0041 | E1040 | Aditi Joshi | Y | 2026-03-12 |  | Yes — active guarantee | Point 9 — blocked from her own loan and from standing guarantor again |
| LN-2026-0041 | E1041 | Mahesh Shinde | Y | 2026-03-12 |  | Yes — active guarantee | Point 9 — this is why LN-APP-2026-0014 was rejected |
| LN-2026-0009 | E1054 | Selvaraj Murugan | Y | 2026-01-18 |  | Yes — active guarantee |  |
| LN-2026-0009 | E1055 | Kalaivani Subramani | Y | 2026-01-18 |  | Yes — active guarantee |  |
| LN-2026-0009 | E1057 | Bhuvaneswari Raman | N | 2026-01-18 |  | Yes — active guarantee | The optional third guarantor, taken because the amount exceeded 10 lakh |
| LN-2025-0112 | E1047 | Koteswara Rao | Y | 2025-04-08 | 2026-06-30 | No — released | Point 9 — release on full repayment restores eligibility |
| LN-2025-0112 | E1048 | Sirisha Yadav | Y | 2025-04-08 | 2026-06-30 | No — released |  |
| LN-2026-0012 | E1016 | Basavaraj Hiremath | Y | 2026-02-05 |  | Yes — active guarantee |  |
| LN-2026-0012 | E1021 | Rekha Deshpande | Y | 2026-02-05 |  | Yes — active guarantee |  |
| Two mandatory guarantors on every loan, with an optional third above a configured amount. Release on full repayment is an explicit event — without it, a guarantor stays blocked forever. |  |  |  |  |  |  |  |

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
| Size | 92 | specified items (table rows) | Counted automatically at generation |
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
