// Clean in-code defaults for HRMSContext (decoupled from context.HRMSContext.json)
// Employees, workflows, and policy documents are loaded live from the database.

export const HRMS_DEFAULTS = {
  "defaultValue_1": "info",
  "user_1": {
    "name": "Authenticated User",
    "email": "user@nucleus.ai",
    "role": "EMPLOYEE",
    "dept": "Operations",
    "location": "Headquarters",
    "avatar": "https://ui-avatars.com/api/?name=User&background=fff&color=2563ea"
  },
  "attendance_2": {
    "status": "present",
    "punchInTime": "09:30 AM",
    "punchOutTime": null,
    "totalHours": "4h 45m",
    "source": "Mobile GPS + Biometric Sync",
    "shift": "General Shift (09:00 AM - 06:00 PM)",
    "history": [
      {
        "date": "Today",
        "in": "09:30 AM",
        "out": "-",
        "status": "Present",
        "source": "Mobile GPS",
        "log": "Frontend development & module setup"
      },
      {
        "date": "Yesterday",
        "in": "09:15 AM",
        "out": "06:30 PM",
        "status": "Present",
        "source": "Office Biometric",
        "log": "Sprint planning and review"
      },
      {
        "date": "28 Jan 2026",
        "in": "09:45 AM",
        "out": "06:40 PM",
        "status": "Late",
        "source": "Web Portal",
        "log": "Design system implementation"
      },
      {
        "date": "27 Jan 2026",
        "in": "09:00 AM",
        "out": "06:00 PM",
        "status": "Present",
        "source": "WhatsApp Bot",
        "log": "API integrations"
      }
    ]
  },
  "attendanceAnomalies_3": [
    {
      "id": 1,
      "employee": "Amit Verma",
      "type": "Buddy Punching Alert",
      "confidence": "94%",
      "note": "Biometric device IP mismatch with office subnet."
    },
    {
      "id": 2,
      "employee": "Rahul Saxena",
      "type": "Late Pattern (3 consecutive Mondays)",
      "confidence": "88%",
      "note": "Average delay: 48 minutes."
    }
  ],
  "timeStr_4": {
    "hour": "2-digit",
    "minute": "2-digit"
  },
  "punchIn_fields_5": {
    "status": "present"
  },
  "history_fields_6": {
    "date": "Today"
  },
  "history_fields_7": {
    "out": "-",
    "status": "Present",
    "source": "Web Portal"
  },
  "timeStr_8": {
    "hour": "2-digit",
    "minute": "2-digit"
  },
  "punchOut_fields_9": {
    "status": "punched_out"
  },
  "gatePasses_10": [
    {
      "id": "GP-2026-001",
      "employee_id": "EMP-101",
      "employee_name": "Trisha Khanna",
      "date": "2026-09-10",
      "type": "OFFICIAL",
      "minutes": 60,
      "reason": "Client site emergency consultation at Electronic City Hub",
      "status": "APPROVED",
      "approved_by": "Amit Verma (Director)",
      "applied_at": "2026-09-10T11:15:00"
    },
    {
      "id": "GP-2026-002",
      "employee_id": "EMP-009",
      "employee_name": "Ramesh Kumar",
      "date": "2026-09-08",
      "type": "PERSONAL",
      "minutes": 45,
      "reason": "Family medical emergency pass",
      "status": "APPROVED",
      "approved_by": "Vikram Seth (Asst. Manager)",
      "applied_at": "2026-09-08T14:20:00"
    }
  ],
  "defaultValue_2": "EMP-101",
  "defaultValue_3": "Trisha Khanna",
  "defaultValue_4": "2026-09-11",
  "defaultValue_5": "PERSONAL",
  "defaultValue_6": 60,
  "requestGatePass_fields_11": {
    "success": false
  },
  "newPass_fields_12": {
    "status": "APPROVED",
    "approved_by": "Policy Engine Auto-Rule"
  },
  "requestGatePass_fields_13": {
    "success": true
  },
  "approveGatePass_fields_14": {
    "status": "APPROVED"
  },
  "timeOfficeLedger_15": [
    {
      "id": "TOL-001",
      "employee_id": "EMP-009",
      "employee_name": "Ramesh Kumar",
      "designation": "Line Assembler",
      "worker_category_code": "CONTRACT",
      "wage_type": "daily",
      "location_id": "LOC-BLR-01",
      "attendance_date": "2026-09-10",
      "shift_id_assigned": "SHIFT-8H",
      "shift_id_inferred": "SHIFT-8H",
      "shift_name": "General Day Shift (8h)",
      "raw_punches": [
        {
          "timestamp": "2026-09-10T08:00:00",
          "type": "IN",
          "source": "BIOMETRIC_PLANT_GATE_A"
        },
        {
          "timestamp": "2026-09-10T20:30:00",
          "type": "OUT",
          "source": "CANTEEN_TURNSTILE"
        },
        {
          "timestamp": "2026-09-10T21:15:00",
          "type": "IN",
          "source": "CANTEEN_TURNSTILE"
        },
        {
          "timestamp": "2026-09-11T03:20:00",
          "type": "OUT",
          "source": "BIOMETRIC_PLANT_GATE_A"
        }
      ],
      "gross_minutes": 1160,
      "break_minutes": 45,
      "gate_pass_minutes": 0,
      "net_minutes": 1115,
      "formatted_net": "18h 35m",
      "ot_minutes": 635,
      "formatted_ot": "10h 35m",
      "status": "present",
      "status_reason": "19h 20m cross-midnight shift with 45m dinner break. 10h 35m daily OT approved.",
      "breaks": [
        {
          "id": "BRK-1",
          "from_ts": "2026-09-10T20:30:00",
          "to_ts": "2026-09-10T21:15:00",
          "minutes": 45,
          "type": "DINNER_BREAK",
          "paid": false
        }
      ],
      "demo_point": "Point 1 & Point 2 (Cross-midnight + Contractual daily OT)"
    },
    {
      "id": "TOL-002",
      "employee_id": "EMP-101",
      "employee_name": "Trisha Khanna",
      "designation": "Senior Developer",
      "worker_category_code": "PERM",
      "wage_type": "monthly",
      "location_id": "LOC-BLR-01",
      "attendance_date": "2026-09-10",
      "shift_id_assigned": "SHIFT-9H",
      "shift_id_inferred": "SHIFT-9H",
      "shift_name": "Standard Corporate Shift (9h)",
      "raw_punches": [
        {
          "timestamp": "2026-09-10T09:15:00",
          "type": "IN",
          "source": "OFFICE_BIOMETRIC"
        },
        {
          "timestamp": "2026-09-10T18:30:00",
          "type": "OUT",
          "source": "OFFICE_BIOMETRIC"
        }
      ],
      "gross_minutes": 555,
      "break_minutes": 0,
      "gate_pass_minutes": 60,
      "net_minutes": 615,
      "formatted_net": "10h 15m",
      "ot_minutes": 0,
      "formatted_ot": "0h 00m",
      "status": "present",
      "status_reason": "Fulfilled 9h schedule. +60m Gate Pass (Client Consultation) added to net presence.",
      "breaks": [],
      "demo_point": "Point 11 (Gate Pass minutes added to net hours)"
    },
    {
      "id": "TOL-003",
      "employee_id": "EMP-001",
      "employee_name": "Vikram Seth",
      "designation": "Assistant Manager - Operations",
      "worker_category_code": "PERM",
      "wage_type": "monthly",
      "location_id": "LOC-BLR-01",
      "attendance_date": "2026-09-11",
      "shift_id_assigned": "SHIFT-8H",
      "shift_id_inferred": "SHIFT-8H",
      "shift_name": "General Day Shift (8h)",
      "raw_punches": [
        {
          "timestamp": "2026-09-11T09:25:00",
          "type": "IN",
          "source": "PLANT_GATE_A"
        },
        {
          "timestamp": "2026-09-11T18:00:00",
          "type": "OUT",
          "source": "PLANT_GATE_A"
        }
      ],
      "gross_minutes": 515,
      "break_minutes": 0,
      "gate_pass_minutes": 0,
      "net_minutes": 515,
      "formatted_net": "8h 35m",
      "ot_minutes": 0,
      "formatted_ot": "0h 00m",
      "status": "present",
      "status_reason": "4th monthly late clock-in (09:25 AM) — Exempt from grace deduction (Assistant Manager+)",
      "is_grace_exempt": true,
      "late_instance_no": 4,
      "breaks": [],
      "demo_point": "Point 12 (Assistant Manager grace exemption on 4th late clock-in)"
    },
    {
      "id": "TOL-004",
      "employee_id": "EMP-104",
      "employee_name": "Rahul Saxena",
      "designation": "Senior UX Designer",
      "worker_category_code": "PERM",
      "wage_type": "monthly",
      "location_id": "LOC-BLR-01",
      "attendance_date": "2026-09-11",
      "shift_id_assigned": "SHIFT-8H",
      "shift_id_inferred": "SHIFT-8H",
      "shift_name": "General Day Shift (8h)",
      "raw_punches": [
        {
          "timestamp": "2026-09-11T09:25:00",
          "type": "IN",
          "source": "OFFICE_BIOMETRIC"
        },
        {
          "timestamp": "2026-09-11T17:30:00",
          "type": "OUT",
          "source": "OFFICE_BIOMETRIC"
        }
      ],
      "gross_minutes": 485,
      "break_minutes": 0,
      "gate_pass_minutes": 0,
      "net_minutes": 485,
      "formatted_net": "8h 05m",
      "ot_minutes": 0,
      "formatted_ot": "0h 00m",
      "status": "half_day",
      "status_reason": "4th monthly late clock-in (09:25 AM vs 09:00 AM) — Converted to Half-Day penalty",
      "is_grace_exempt": false,
      "late_instance_no": 4,
      "late_forgiven": false,
      "breaks": [],
      "demo_point": "Point 12 (4th monthly late instance penalty: converts to half-day)"
    },
    {
      "id": "TOL-005",
      "employee_id": "EMP-015",
      "employee_name": "Anand Kulkarni",
      "designation": "Quality Inspector",
      "worker_category_code": "THIRD_PARTY_EMP",
      "wage_type": "monthly",
      "location_id": "LOC-PUN-02",
      "attendance_date": "2026-09-11",
      "shift_id_assigned": "SHIFT-8H",
      "shift_id_inferred": "SHIFT-B-EVENING",
      "shift_name": "Evening Operations Shift (8h)",
      "raw_punches": [
        {
          "timestamp": "2026-09-11T14:02:00",
          "type": "IN",
          "source": "PUNE_GATE_2"
        },
        {
          "timestamp": "2026-09-11T22:30:00",
          "type": "OUT",
          "source": "PUNE_GATE_2"
        }
      ],
      "gross_minutes": 508,
      "break_minutes": 0,
      "gate_pass_minutes": 0,
      "net_minutes": 508,
      "formatted_net": "8h 28m",
      "ot_minutes": 0,
      "formatted_ot": "0h 00m",
      "status": "present",
      "status_reason": "Auto-inferred Evening Shift from 14:02 in-punch. 2nd late clock-in forgiven (2 of 3 monthly grace used).",
      "shift_inferred": true,
      "late_instance_no": 2,
      "late_forgiven": true,
      "breaks": [],
      "demo_point": "Point 3, Point 4, Point 12, Point 13 (Inferred shift + Late forgiveness)"
    },
    {
      "id": "TOL-006",
      "employee_id": "EMP-012",
      "employee_name": "Suresh Patel",
      "designation": "Warehouse Helper",
      "worker_category_code": "THIRD_PARTY_HELPER",
      "wage_type": "daily",
      "location_id": "LOC-PUN-02",
      "attendance_date": "2026-09-13",
      "shift_id_assigned": "SHIFT-8H",
      "shift_id_inferred": "SHIFT-8H",
      "shift_name": "General Day Shift (8h)",
      "raw_punches": [
        {
          "timestamp": "2026-09-13T08:30:00",
          "type": "IN",
          "source": "PUNE_WAREHOUSE"
        },
        {
          "timestamp": "2026-09-13T17:30:00",
          "type": "OUT",
          "source": "PUNE_WAREHOUSE"
        }
      ],
      "gross_minutes": 540,
      "break_minutes": 0,
      "gate_pass_minutes": 0,
      "net_minutes": 540,
      "formatted_net": "9h 00m",
      "ot_minutes": 60,
      "formatted_ot": "1h 00m",
      "status": "present",
      "status_reason": "Sunday work: Helper category has NO rest days (Daily wage + 1h OT payable).",
      "breaks": [],
      "demo_point": "Point 3 & Point 4 (Helper no rest days, daily wages, OT eligible)"
    }
  ],
  "defaultValue_7": "SHIFT-8H",
  "defaultValue_8": 0,
  "fallback_1": "PERM",
  "fallback_2": "LOC-BLR-01",
  "leaveApplications_18": [
    {
      "id": "LA-2026-101",
      "employee_id": "EMP-101",
      "employee_name": "Trisha Khanna",
      "leave_type_code": "PRIVILEGE",
      "leave_type_label": "Privilege Leave (EL)",
      "start_date": "2026-09-14",
      "end_date": "2026-09-18",
      "duration_days": 5,
      "chargeable_days": 3,
      "original_chargeable_days": 5,
      "status": "SHORT_CLOSED",
      "actual_return_date": "2026-09-17",
      "adjusted_end_date": "2026-09-16",
      "reason": "Annual family festival gathering",
      "recredit_days": 2,
      "demo_point": "Point 5: Early return (Mon-Fri 5d applied, returned Thu -> 2 days re-credited)"
    },
    {
      "id": "LA-2026-102",
      "employee_id": "EMP-104",
      "employee_name": "Rahul Saxena",
      "leave_type_code": "PRIVILEGE",
      "leave_type_label": "Privilege Leave (EL)",
      "start_date": "2026-10-05",
      "end_date": "2026-10-09",
      "duration_days": 5,
      "chargeable_days": 5,
      "status": "PENDING_HOD",
      "current_approval_tier": "HOD",
      "approval_history": [
        {
          "tier": "SUPERVISOR",
          "action": "APPROVED",
          "reviewer": "Sarah Chen (Lead PM)",
          "remarks": "Design delivery sprint aligned",
          "timestamp": "2026-09-10T10:00:00"
        }
      ],
      "reason": "Design sprint replenishment time-off",
      "demo_point": "Point 5: 3-Level Sequential Approval (Supervisor -> HOD -> HR Head)"
    },
    {
      "id": "LA-2026-103",
      "employee_id": "EMP-001",
      "employee_name": "Vikram Seth",
      "leave_type_code": "PRIVILEGE",
      "leave_type_label": "Privilege Leave (EL)",
      "start_date": "2026-09-18",
      "end_date": "2026-09-21",
      "duration_days": 4,
      "chargeable_days": 4,
      "working_days": 2,
      "weekend_days": 2,
      "sandwich_rule_applied": true,
      "status": "APPROVED",
      "reason": "Long weekend family trip",
      "demo_point": "Point 6: Sandwich rule applied (Fri+Mon leave debits Sat+Sun = 4 days)"
    }
  ],
  "compOffCredits_17": [
    {
      "id": "CO-2026-001",
      "employee_id": "EMP-101",
      "credited_at": "2026-07-01",
      "source": "Rest-day deployment for Cloud Migration",
      "days": 1,
      "status": "LAPSED_60_DAYS",
      "expires_at": "2026-08-30"
    },
    {
      "id": "CO-2026-002",
      "employee_id": "EMP-101",
      "credited_at": "2026-08-15",
      "source": "Independence Day on-call rotation",
      "days": 1,
      "status": "ACTIVE",
      "expires_at": "2026-10-14"
    },
    {
      "id": "CO-2026-003",
      "employee_id": "EMP-101",
      "credited_at": "2026-08-25",
      "source": "Sunday plant equipment audit",
      "days": 1,
      "status": "ACTIVE",
      "expires_at": "2026-10-24"
    }
  ],
  "leaves_16": {
    "sick": {
      "available": 8,
      "total": 10
    },
    "casual": {
      "available": 9,
      "total": 12
    },
    "privilege": {
      "available": 16,
      "total": 25
    },
    "wellness": {
      "available": 3,
      "total": 4
    },
    "comp_off": {
      "available": 2,
      "total": 3
    },
    "history": [
      {
        "id": 1,
        "type": "Privilege Leave",
        "date": "Feb 12 - Feb 14, 2026",
        "duration": "3 Days",
        "status": "Approved",
        "reason": "Family event"
      },
      {
        "id": 2,
        "type": "Sick Leave",
        "date": "Jan 15, 2026",
        "duration": "1 Day",
        "status": "Approved",
        "reason": "Viral fever"
      },
      {
        "id": 3,
        "type": "Wellness Day",
        "date": "Feb 28, 2026",
        "duration": "1 Day",
        "status": "Pending",
        "reason": "Vedic rest & reflection"
      }
    ]
  },
  "employees_28": [],
  "teamMembers_29": [
    {
      "id": "TM-01",
      "name": "Amit Verma",
      "role": "Director of Engineering",
      "dept": "Engineering",
      "pod": "Core Platform & Architecture",
      "email": "amit@nucleus.ai",
      "phone": "+91 98111 22334",
      "location": "Bengaluru / Hybrid",
      "status": "online",
      "shift": "09:00 AM - 06:00 PM",
      "skills": [
        "Distributed Systems",
        "Go",
        "Kubernetes",
        "Architecture"
      ],
      "projects": [
        "Nucleus 2.0",
        "Kafka Ledger"
      ],
      "bg": "2563eb"
    },
    {
      "id": "TM-02",
      "name": "Trisha Khanna",
      "role": "Senior Platform Architect",
      "dept": "Engineering",
      "pod": "UI / UX & Frontend Pod",
      "email": "trisha@nucleus.ai",
      "phone": "+91 98765 43210",
      "location": "Bengaluru / Hybrid",
      "status": "online",
      "shift": "09:30 AM - 06:30 PM",
      "skills": [
        "React",
        "Next.js",
        "System Design",
        "TypeScript"
      ],
      "projects": [
        "Design System",
        "MKraft UI"
      ],
      "bg": "7c3aed"
    },
    {
      "id": "TM-03",
      "name": "Sarah Chen",
      "role": "Lead Product Manager",
      "dept": "Product",
      "pod": "Product Strategy & Growth",
      "email": "sarah@nucleus.ai",
      "phone": "+65 9123 4567",
      "location": "Singapore",
      "status": "busy",
      "shift": "08:00 AM - 05:00 PM",
      "skills": [
        "Product Strategy",
        "OKR Planning",
        "Roadmapping",
        "Agile"
      ],
      "projects": [
        "Q1 Feature Sprint",
        "Reseller Portal"
      ],
      "bg": "0284c7"
    },
    {
      "id": "TM-04",
      "name": "Rahul Saxena",
      "role": "Senior UX Designer",
      "dept": "Design",
      "pod": "UI / UX & Design Pod",
      "email": "rahul@nucleus.ai",
      "phone": "+91 98222 33445",
      "location": "Bengaluru",
      "status": "online",
      "shift": "10:00 AM - 07:00 PM",
      "skills": [
        "Figma",
        "Design Systems",
        "Micro-interactions",
        "Prototyping"
      ],
      "projects": [
        "Nucleus DS 2.0",
        "Mobile App"
      ],
      "bg": "f59e0b"
    },
    {
      "id": "TM-05",
      "name": "Priya Nair",
      "role": "Full Stack Engineer",
      "dept": "Engineering",
      "pod": "Core Platform & Architecture",
      "email": "priya@nucleus.ai",
      "phone": "+91 98333 44556",
      "location": "Remote / Kochi",
      "status": "away",
      "shift": "09:00 AM - 06:00 PM",
      "skills": [
        "Node.js",
        "PostgreSQL",
        "React",
        "Docker"
      ],
      "projects": [
        "API Gateway",
        "OpenAPI Sandbox"
      ],
      "bg": "10b981"
    },
    {
      "id": "TM-06",
      "name": "David Miller",
      "role": "Senior DevOps Architect",
      "dept": "Infrastructure",
      "pod": "Cloud Ops & Security",
      "email": "david@nucleus.ai",
      "phone": "+44 20 7946 0991",
      "location": "London, UK",
      "status": "online",
      "shift": "01:30 PM - 10:30 PM IST",
      "skills": [
        "AWS KMS",
        "Terraform",
        "Kafka Streams",
        "CI/CD"
      ],
      "projects": [
        "AWS ap-south-1 VPC",
        "AES-256 Vault"
      ],
      "bg": "ec4899"
    },
    {
      "id": "TM-07",
      "name": "Ananya Sharma",
      "role": "HR Business Partner",
      "dept": "Human Resources",
      "pod": "Talent & People Ops",
      "email": "ananya@nucleus.ai",
      "phone": "+91 98444 55667",
      "location": "Bengaluru",
      "status": "online",
      "shift": "09:00 AM - 06:00 PM",
      "skills": [
        "Talent Acquisition",
        "MCI Evaluation",
        "Vedic Wellness"
      ],
      "projects": [
        "Onboarding 30-60-90",
        "Performance Review"
      ],
      "bg": "8b5cf6"
    },
    {
      "id": "TM-08",
      "name": "Vikram Joshi",
      "role": "Finance & Payroll Specialist",
      "dept": "Finance",
      "pod": "Finance & Compliance",
      "email": "vikram@nucleus.ai",
      "phone": "+91 98555 66778",
      "location": "Bengaluru",
      "status": "busy",
      "shift": "09:30 AM - 06:30 PM",
      "skills": [
        "Statutory Tax",
        "EWA Disbursal",
        "GL Reconciliation",
        "SAP"
      ],
      "projects": [
        "Feb Payroll Run",
        "Tax Compliance Packs"
      ],
      "bg": "f97316"
    }
  ],
  "positions_30": [
    {
      "id": "POS-301",
      "title": "Senior Backend Engineer (Go)",
      "dept": "Engineering",
      "openSlots": 2,
      "filled": 1,
      "budget": "₹28,00,000 / yr",
      "status": "Hiring Active",
      "requisitionType": "NEW_ADDITION"
    },
    {
      "id": "POS-302",
      "title": "Full Stack Engineer",
      "dept": "Engineering",
      "openSlots": 1,
      "filled": 0,
      "budget": "₹20,00,000 / yr",
      "status": "Hiring Active",
      "requisitionType": "NEW_ADDITION"
    },
    {
      "id": "POS-303",
      "title": "HR Business Partner",
      "dept": "Human Resources",
      "openSlots": 1,
      "filled": 1,
      "budget": "₹18,00,000 / yr",
      "status": "Filled",
      "requisitionType": "NEW_ADDITION"
    },
    {
      "id": "POS-DES-104",
      "title": "Senior UX Designer (Backfill)",
      "dept": "Design",
      "openSlots": 1,
      "filled": 0,
      "budget": "₹22,00,000 / yr",
      "status": "Hiring Active",
      "requisitionType": "REPLACEMENT",
      "vacatedPositionCode": "POS-DES-104",
      "previousIncumbentId": "EMP-104"
    }
  ],
  "createJobRequisition_fields_31": {
    "success": false
  },
  "newPos_fields_32": {
    "openSlots": 1,
    "filled": 0
  },
  "fallback_6": "₹20,00,000 / yr",
  "newPos_fields_33": {
    "status": "Hiring Active"
  },
  "fallback_7": "NEW_ADDITION",
  "createJobRequisition_fields_34": {
    "success": true
  },
  "fallback_8": "LAPTOP",
  "fallback_9": "Corporate Hardware",
  "fallback_10": "Employee",
  "newAsset_fields_35": {
    "status": "ASSIGNED"
  },
  "fallback_11": "New",
  "fallback_12": 100000,
  "defaultValue_10": "Good",
  "markAssetReturned_fields_36": {
    "status": "RETURNED_AVAILABLE"
  },
  "fallback_13": "Staff Member",
  "fallback_14": "SPOT_AWARD",
  "fallback_15": 10000,
  "fallback_16": "Executive Leadership",
  "date_38": {
    "day": "2-digit",
    "month": "short",
    "year": "numeric"
  },
  "newAward_fields_37": {
    "status": "APPROVED_AND_BROADCAST"
  },
  "fallback_17": "Engineering",
  "fallback_18": "EMP-101",
  "fallback_19": "Trisha Khanna",
  "newRef_fields_39": {
    "status": "SUBMITTED",
    "joiningDate": null,
    "daysSinceJoining": 0,
    "totalBonusEligible": 25000,
    "disbursedAmount": 0,
    "pendingAmount": 25000,
    "nextPayoutMilestone": "On Candidate Joining (₹10,000 Initial Installment)"
  },
  "documents_40": [
    {
      "id": 1,
      "title": "Employment Contract - 2023",
      "type": "Contract",
      "verified": true,
      "expiry": "Indefinite",
      "ocrStatus": "Indexed"
    },
    {
      "id": 2,
      "title": "Passport Verification (Aadhaar Linked)",
      "type": "Identity",
      "verified": true,
      "expiry": "14 May 2031",
      "ocrStatus": "Verified"
    },
    {
      "id": 3,
      "title": "AWS Solutions Architect Professional",
      "type": "Certification",
      "verified": true,
      "expiry": "12 Nov 2026",
      "ocrStatus": "Valid"
    },
    {
      "id": 4,
      "title": "NDA & IP Assignment Agreement",
      "type": "Legal",
      "verified": true,
      "expiry": "Active",
      "ocrStatus": "Indexed"
    }
  ],
  "auditLogs_41": [
    {
      "id": "AUD-8821",
      "field": "Designation",
      "oldValue": "Software Engineer",
      "newValue": "Senior Developer",
      "changedBy": "HR Admin",
      "timestamp": "15 Jan 2026, 14:32"
    },
    {
      "id": "AUD-8820",
      "field": "Compensation Band",
      "oldValue": "L3-Mid",
      "newValue": "L4-Senior",
      "changedBy": "Compensation Committee",
      "timestamp": "15 Jan 2026, 11:20"
    },
    {
      "id": "AUD-8819",
      "field": "Bank Account IFSC",
      "oldValue": "HDFC0001023",
      "newValue": "ICIC0000491",
      "changedBy": "Trisha Khanna",
      "timestamp": "03 Jan 2026, 09:10"
    }
  ],
  "payrollSummary_42": {
    "lastNetPay": "₹ 1,45,200",
    "nextPayDate": "Feb 28, 2026",
    "basicSalary": "₹ 80,000",
    "hra": "₹ 40,000",
    "specialAllowance": "₹ 35,000",
    "providentFund": "₹ 9,600",
    "professionalTax": "₹ 200",
    "tdsEstimated": "₹ 15,000",
    "netDisbursal": "₹ 1,30,200",
    "ewaAvailable": "₹ 45,000",
    "ewaMaxLimit": "₹ 65,000",
    "prePayrollAIStatus": "Audit Passed (0 anomalies detected in current batch)"
  },
  "ewaTransactions_43": [
    {
      "id": "EWA-901",
      "date": "Jan 20, 2026",
      "amount": "₹ 15,000",
      "status": "Settled",
      "fee": "₹ 0 (Direct Bank API)"
    }
  ],
  "requestEWA_fields_44": {
    "date": "Today"
  },
  "requestEWA_fields_45": {
    "status": "Instant Disbursed to Bank",
    "fee": "₹ 0"
  },
  "currentRoleContext_46": {
    "role": "HO_HR_ADMIN",
    "scope": "ENTERPRISE",
    "location": "Corporate Head Office"
  },
  "companyLoans_47": [
    {
      "id": "LOAN-1001",
      "borrowerId": "EMP-104",
      "borrowerName": "Rahul Saxena",
      "borrowerRole": "Senior UX Designer",
      "borrowerDept": "Design",
      "principalAmount": 180000,
      "remainingBalance": 90000,
      "monthlyEMI": 15000,
      "tenureMonths": 12,
      "paidInstallments": 6,
      "disbursedAt": "15 Aug 2025",
      "purpose": "Home Renovation Welfare Advance",
      "guarantors": [
        "EMP-101",
        "EMP-105"
      ],
      "guarantorNames": [
        "Trisha Khanna (EMP-101)",
        "Priya Nair (EMP-105)"
      ],
      "status": "ACTIVE",
      "isManagementOverride": false
    },
    {
      "id": "LOAN-1002",
      "borrowerId": "EMP-001",
      "borrowerName": "Vikram Seth",
      "borrowerRole": "Assistant Manager - Operations",
      "borrowerDept": "Manufacturing",
      "principalAmount": 150000,
      "remainingBalance": 0,
      "monthlyEMI": 15000,
      "tenureMonths": 10,
      "paidInstallments": 10,
      "disbursedAt": "10 Jan 2025",
      "purpose": "Medical Assistance",
      "guarantors": [
        "EMP-102",
        "EMP-106"
      ],
      "guarantorNames": [
        "Amit Verma (EMP-102)",
        "David Miller (EMP-106)"
      ],
      "status": "REPAID",
      "isManagementOverride": false
    }
  ],
  "applyForCompanyLoan_fields_48": {
    "success": false
  },
  "fallback_20": "Employee",
  "fallback_21": "General",
  "newLoan_fields_49": {
    "paidInstallments": 0,
    "disbursedAt": "Today"
  },
  "fallback_22": "Personal Welfare",
  "newLoan_fields_50": {
    "status": "ACTIVE"
  },
  "applyForCompanyLoan_fields_51": {
    "success": true
  },
  "payrollRuns_52": [
    {
      "id": "RUN-REG-202602",
      "type": "REGULAR",
      "label": "Regular Monthly Salary Cycle · Feb 2026",
      "cyclePeriod": "Feb 2026",
      "batchDate": "2026-02-28",
      "disbursementDate": "28 Feb 2026",
      "employeeCount": 248,
      "totalDisbursement": 14820000,
      "status": "DISBURSED",
      "bankFileRef": "NEFT_CORP_FEB2026_DISBURSE.txt",
      "notes": "Standard month-end corporate payroll run across all 4 sites"
    },
    {
      "id": "RUN-OT-202601",
      "type": "OFF_CYCLE_OT",
      "label": "Off-Cycle Overtime Batch · Jan 2026 OT",
      "cyclePeriod": "Jan 2026",
      "batchDate": "2026-02-10",
      "disbursementDate": "10 Feb 2026",
      "employeeCount": 84,
      "totalHours": 420,
      "totalDisbursement": 745000,
      "status": "DISBURSED",
      "bankFileRef": "NEFT_OT_DISBURSE_JAN2026.txt",
      "notes": "Off-cycle overtime run computed separately from attendance ledger"
    },
    {
      "id": "RUN-ARR-202602",
      "type": "ARREARS",
      "label": "Retro Salary & DA Arrears Batch · Feb 2026",
      "cyclePeriod": "Feb 2026",
      "batchDate": "2026-02-15",
      "disbursementDate": "15 Feb 2026",
      "employeeCount": 32,
      "totalDisbursement": 1420000,
      "status": "AUDITED",
      "bankFileRef": "NEFT_ARREARS_FEB2026.txt",
      "notes": "Retroactive appraisal increment adjustments approved by Compensation Committee"
    },
    {
      "id": "RUN-FNF-202602",
      "type": "FNF",
      "label": "Full & Final (F&F) Same-Day Batch · Feb 2026",
      "cyclePeriod": "Feb 2026",
      "batchDate": "2026-02-28",
      "disbursementDate": "Immediate upon 4-Dept Clearance",
      "employeeCount": 2,
      "totalDisbursement": 362000,
      "status": "READY_FOR_BANK_FILE",
      "bankFileRef": "NEFT_FNF_BATCH_FEB2026.txt",
      "notes": "Exiting employee settlements with statutory gratuity & loan deductions"
    }
  ],
  "otRecords_53": [
    {
      "employeeId": "EMP-101",
      "employeeName": "Trisha Khanna",
      "otHours": 12
    },
    {
      "employeeId": "EMP-105",
      "employeeName": "Priya Nair",
      "otHours": 16
    },
    {
      "employeeId": "EMP-001",
      "employeeName": "Vikram Seth",
      "otHours": 18
    },
    {
      "employeeId": "EMP-009",
      "employeeName": "Ramesh Kumar",
      "otHours": 24
    }
  ],
  "fallback_23": "Feb 2026 OT",
  "fallback_24": "Feb 2026 Arrears",
  "createOffCycleRun_fields_54": {
    "arrearsItems": [
      {
        "employeeId": "EMP-101",
        "employeeName": "Trisha Khanna",
        "arrearsAmount": 18000,
        "reason": "Q4 Performance Band Revision"
      },
      {
        "employeeId": "EMP-104",
        "employeeName": "Rahul Saxena",
        "arrearsAmount": 9000,
        "reason": "Special HRA Correction"
      }
    ]
  },
  "fallback_25": "Current Period",
  "createOffCycleRun_fields_56": {
    "disbursementDate": "Next Scheduled Pay Date",
    "employeeCount": 10,
    "totalDisbursement": 250000,
    "status": "READY_FOR_BANK_FILE"
  },
  "fnfSettlements_57": [
    {
      "settlementId": "FNF-EMP-104-20260228",
      "employeeId": "EMP-104",
      "employeeName": "Rahul Saxena",
      "designation": "Senior UX Designer",
      "department": "Design",
      "joinDate": "10 Nov 2023",
      "exitDate": "2026-02-28",
      "tenureYears": 5,
      "unpaidDays": 25,
      "elBalance": 12,
      "noticeShortfallDays": 5,
      "travelAdvanceDeduction": 5000,
      "departmentClearances": {
        "IT": {
          "status": "CLEARED",
          "remarks": "MacBook Pro M2 serial #C02G8726 verified, email disabled",
          "officer": "David Miller"
        },
        "FINANCE": {
          "status": "CLEARED",
          "remarks": "Amex Card surrendered, ₹90,000 loan balance offset in final calculation",
          "officer": "Vikram Joshi"
        },
        "HOD": {
          "status": "CLEARED",
          "remarks": "Design System Figma library handover completed to Priya Nair",
          "officer": "Sarah Chen"
        },
        "HR": {
          "status": "CLEARED",
          "remarks": "Access badge #B-881 returned, Form 19/10C exit pack submitted",
          "officer": "Ananya Sharma"
        }
      },
      "status": "CLEARED_FOR_DISBURSEMENT"
    },
    {
      "settlementId": "FNF-EMP-106-20260315",
      "employeeId": "EMP-106",
      "employeeName": "David Miller",
      "designation": "Senior DevOps Architect",
      "department": "Infrastructure",
      "joinDate": "05 Feb 2022",
      "exitDate": "2026-03-15",
      "tenureYears": 4.1,
      "unpaidDays": 15,
      "elBalance": 8,
      "noticeShortfallDays": 0,
      "travelAdvanceDeduction": 0,
      "departmentClearances": {
        "IT": {
          "status": "CLEARED",
          "remarks": "Hardware & YubiKeys surrendered",
          "officer": "David Miller"
        },
        "FINANCE": {
          "status": "PENDING",
          "remarks": "Awaiting UK relocation expense audit voucher",
          "officer": "Vikram Joshi"
        },
        "HOD": {
          "status": "CLEARED",
          "remarks": "Kubernetes cluster credentials rotated & signed off",
          "officer": "Amit Verma"
        },
        "HR": {
          "status": "PENDING",
          "remarks": "Exit interview scheduled for 14 March 2026",
          "officer": "Ananya Sharma"
        }
      },
      "status": "CLEARANCE_IN_PROGRESS"
    }
  ],
  "candidates_59": [
    {
      "id": "c1",
      "name": "Vikram Malhotra",
      "role": "Full Stack Engineer (React/Go)",
      "stage": "interview",
      "matchScore": 94,
      "skills": [
        "React",
        "Go",
        "Microservices",
        "GraphQL"
      ],
      "exp": "5.5 yrs",
      "biasScore": "Fair & Neutral"
    },
    {
      "id": "c2",
      "name": "Ananya Deshmukh",
      "role": "Product Designer (Figma)",
      "stage": "screening",
      "matchScore": 89,
      "skills": [
        "Figma",
        "Design Systems",
        "UX Research"
      ],
      "exp": "4 yrs",
      "biasScore": "Fair & Neutral"
    },
    {
      "id": "c3",
      "name": "Rohan Gupta",
      "role": "AI / ML Engineer (PyTorch)",
      "stage": "offer",
      "matchScore": 96,
      "skills": [
        "PyTorch",
        "Transformers",
        "LLMOps",
        "Python"
      ],
      "exp": "6 yrs",
      "biasScore": "Fair & Neutral"
    },
    {
      "id": "c4",
      "name": "Meera Iyer",
      "role": "Technical Program Manager",
      "stage": "sourced",
      "matchScore": 82,
      "skills": [
        "Agile",
        "Jira",
        "Stakeholder Mgmt"
      ],
      "exp": "7 yrs",
      "biasScore": "Fair & Neutral"
    }
  ],
  "onboardingTasks_60": [
    {
      "id": "o1",
      "title": "Complete Digital Paperwork & Bank Details",
      "phase": "Pre-boarding",
      "status": "Completed",
      "days": "Day -3"
    },
    {
      "id": "o2",
      "title": "Meet Engineering Buddy (Sarah Chen)",
      "phase": "Day 1",
      "status": "Completed",
      "days": "Day 1"
    },
    {
      "id": "o3",
      "title": "Security & Zero-Trust Access Setup",
      "phase": "Day 1-7",
      "status": "Completed",
      "days": "Day 3"
    },
    {
      "id": "o4",
      "title": "30-Day Check-in & Manager Alignment",
      "phase": "30-Day",
      "status": "In Progress",
      "days": "Day 30"
    },
    {
      "id": "o5",
      "title": "60-Day Capability & Skill Milestone Review",
      "phase": "60-Day",
      "status": "Upcoming",
      "days": "Day 60"
    },
    {
      "id": "o6",
      "title": "90-Day Full Independence Appraisal",
      "phase": "90-Day",
      "status": "Upcoming",
      "days": "Day 90"
    }
  ],
  "completeOnboardingTask_fields_61": {
    "status": "Completed"
  },
  "okrs_62": [
    {
      "id": 1,
      "level": "Company Objective",
      "title": "Build World-Class Microservices & AI Architecture",
      "rag": "green",
      "weight": 40,
      "progress": 82,
      "owner": "Engineering Leadership",
      "keyResults": [
        {
          "label": "Achieve P95 latency under 250ms across all APIs",
          "progress": 90,
          "status": "On Track"
        },
        {
          "label": "Deploy AI Pre-Payroll anomaly detection model",
          "progress": 100,
          "status": "Done"
        },
        {
          "label": "Migrate 100% components to Nucleus V2 design system",
          "progress": 65,
          "status": "In Progress"
        }
      ]
    },
    {
      "id": 2,
      "level": "Individual Goal (Trisha)",
      "title": "Lead Frontend Architecture & Capability Index Modules",
      "rag": "green",
      "weight": 60,
      "progress": 88,
      "owner": "Trisha Khanna",
      "keyResults": [
        {
          "label": "Ship 11 HRMS blueprint modules on web",
          "progress": 95,
          "status": "Nearly Done"
        },
        {
          "label": "Achieve 100% component accessibility & responsiveness",
          "progress": 85,
          "status": "On Track"
        }
      ]
    }
  ],
  "talentMatrix_63": [
    {
      "name": "Trisha Khanna",
      "role": "Senior Developer",
      "box": "Top Talent (High Potential / High Performance)",
      "perf": 92,
      "pot": 95
    },
    {
      "name": "Sarah Chen",
      "role": "Lead PM",
      "box": "Future Leader (High Potential / High Performance)",
      "perf": 90,
      "pot": 92
    },
    {
      "name": "Priya Nair",
      "role": "Full Stack Engineer",
      "box": "High Performer (Mid Potential / High Performance)",
      "perf": 88,
      "pot": 80
    },
    {
      "name": "Rahul Saxena",
      "role": "Senior UX Designer",
      "box": "Core Contributor (Mid Potential / Mid Performance)",
      "perf": 82,
      "pot": 84
    }
  ],
  "newGoal_fields_64": {
    "level": "Individual Goal",
    "title": "Continuous Innovation & Skills Growth",
    "rag": "green",
    "weight": 20,
    "progress": 10
  },
  "newGoal_fields_65": {
    "keyResults": [
      {
        "label": "Complete Advanced Distributed Systems track",
        "progress": 25,
        "status": "Active"
      }
    ]
  },
  "analyticsData_67": {
    "headcount": 248,
    "attritionRate": "4.2%",
    "avgTenure": "2.8 yrs",
    "enpsScore": "+54 (Top Quartile)",
    "payrollMonthly": "₹ 3.84 Cr",
    "predictiveAttritionRisk": [
      {
        "name": "Team Alpha (Infra)",
        "risk": "Low (1.8%)",
        "drivers": "High engagement, competitive comp"
      },
      {
        "name": "Team Beta (QA)",
        "risk": "Medium (7.4%)",
        "drivers": "Career progression ceiling identified"
      },
      {
        "name": "Team Gamma (Sales)",
        "risk": "Low (3.1%)",
        "drivers": "Quota attainment healthy"
      }
    ],
    "payEquityGap": {
      "overallGenderGap": "0.8% (Statistically Insignificant / Parity Achieved)",
      "gradeAdjusted": "100% Fair Pay Index",
      "remediationEstimated": "₹ 0"
    }
  },
  "courses_68": [
    {
      "id": "CRS-101",
      "title": "Modern Cloud Microservices Architecture with Go & Kafka",
      "category": "Engineering",
      "duration": "12 hrs",
      "progress": 85,
      "provider": "Internal Academy",
      "badge": "Certified"
    },
    {
      "id": "CRS-102",
      "title": "Generative AI & LLM Agents in Enterprise Products",
      "category": "AI & Data",
      "duration": "18 hrs",
      "progress": 40,
      "provider": "Coursera Enterprise",
      "badge": "In Progress"
    },
    {
      "id": "CRS-103",
      "title": "Data Privacy & India DPDP Act Compliance 2026",
      "category": "Compliance",
      "duration": "2 hrs",
      "progress": 100,
      "provider": "Mandatory Legal",
      "badge": "Compliant"
    },
    {
      "id": "CRS-104",
      "title": "Vedic Principles for High-Performance Teams & Wellbeing",
      "category": "Leadership & Wellness",
      "duration": "6 hrs",
      "progress": 60,
      "provider": "MKraft Wisdom Hub",
      "badge": "In Progress"
    }
  ],
  "compensationData_69": {
    "band": "L4 - Senior Specialist",
    "salaryRange": "₹ 22,00,000 - ₹ 32,00,000",
    "currentCTC": "₹ 26,50,000",
    "compaRatio": "0.98 (Optimal Market Alignment)",
    "marketBenchmark": "Mercer Tech Industry Benchmark (P75)",
    "flexBenefits": [
      {
        "id": 1,
        "name": "Comprehensive Medical Health Cover (₹ 15L)",
        "selected": true,
        "value": "₹ 18,000 / yr"
      },
      {
        "id": 2,
        "name": "Wellness & Gym Reimbursement",
        "selected": true,
        "value": "₹ 24,000 / yr"
      },
      {
        "id": 3,
        "name": "Home Office & Broadband Allowance",
        "selected": true,
        "value": "₹ 36,000 / yr"
      },
      {
        "id": 4,
        "name": "Executive Mental Health & Coaching Pass",
        "selected": true,
        "value": "₹ 15,000 / yr"
      }
    ]
  },
  "mciScore_70": {
    "overall": 88,
    "tier": "Tier 1 - High Capability Velocity",
    "dimensions": [
      {
        "name": "Skills Depth (25%)",
        "score": 90,
        "note": "Deep mastery in Full-Stack, System Architecture & React"
      },
      {
        "name": "Performance Trajectory (25%)",
        "score": 92,
        "note": "+18% quarter-over-quarter output improvement"
      },
      {
        "name": "Learning Velocity (20%)",
        "score": 85,
        "note": "3 certifications completed in last 6 months"
      },
      {
        "name": "Engagement Health (15%)",
        "score": 86,
        "note": "High peer collaboration and positive sentiment"
      },
      {
        "name": "Leadership Readiness (15%)",
        "score": 82,
        "note": "Active mentoring and cross-team code reviews"
      }
    ]
  },
  "vedicFramework_71": {
    "energyRhythm": "Pitta-Tejas (Peak creative & deep work focus between 09:30 AM - 01:00 PM)",
    "purposeAlignment": "94% alignment with organizational mission",
    "currentDhruvaGoal": "Architect an AI-first capability engine that empowers 50,000+ professionals.",
    "weeklyPulse": "Balanced & Energized"
  },
  "socialFeed_72": [
    {
      "id": 1,
      "author": "Sarah Chen",
      "role": "Lead PM",
      "avatar": "https://ui-avatars.com/api/?name=Sarah+Chen",
      "time": "2 hours ago",
      "text": "Huge shoutout to @Trisha Khanna for shipping the entire 11-module HRMS framework ahead of schedule! 🚀🎉",
      "kudos": 18,
      "tags": [
        "#EngineeringExcellence",
        "#TeamPlayer"
      ]
    },
    {
      "id": 2,
      "author": "Diksha Patel",
      "role": "People Team",
      "avatar": "https://ui-avatars.com/api/?name=Diksha+Patel",
      "time": "Yesterday",
      "text": "Welcome our 8 new joiners in the Engineering and AI tracks! Excited to have you aboard.",
      "kudos": 24,
      "tags": [
        "#WelcomeToNucleus",
        "#Growth"
      ]
    }
  ],
  "connectors_73": [
    {
      "id": "conn-1",
      "name": "SAP S/4HANA & Tally",
      "category": "Accounting & GL",
      "status": "Connected",
      "syncTime": "5 mins ago"
    },
    {
      "id": "conn-2",
      "name": "Slack & Microsoft Teams",
      "category": "Communication",
      "status": "Connected",
      "syncTime": "Live"
    },
    {
      "id": "conn-3",
      "name": "BioTime & eSSL Biometrics",
      "category": "Hardware SDK",
      "status": "Connected",
      "syncTime": "Live Stream"
    },
    {
      "id": "conn-4",
      "name": "ICICI & HDFC Direct Banking",
      "category": "Banking Disbursal",
      "status": "Active (Direct API)",
      "syncTime": "Real-time"
    },
    {
      "id": "conn-5",
      "name": "Jira & ServiceNow ITSM",
      "category": "IT Provisioning",
      "status": "Connected",
      "syncTime": "12 mins ago"
    },
    {
      "id": "conn-6",
      "name": "AuthBridge & Checkr",
      "category": "Background Verification",
      "status": "Active",
      "syncTime": "Instant"
    }
  ],
  "apiKeys_74": [
    {
      "id": "key-1",
      "name": "Production Webhook Key",
      "prefix": "mk_live_9984...",
      "created": "10 Jan 2026",
      "scope": "Read/Write"
    }
  ],
  "projects_75": [
    {
      "id": "proj-1",
      "title": "Website Redesign",
      "desc": "Revamping corporate portal with modern design tokens, accessibility, and high-performance UX.",
      "progress": 75,
      "color": "#3b82f6",
      "due": "Feb 15",
      "members": [
        "Vishal",
        "Sarah Chen",
        "Priya Nair",
        "Trisha Khanna"
      ],
      "createdBy": "Amit Verma",
      "visibility": "team"
    },
    {
      "id": "proj-2",
      "title": "Mobile App Launch",
      "desc": "Native iOS and Android client application for employee self-service and geofenced clock-in.",
      "progress": 40,
      "color": "#f59e0b",
      "due": "Mar 01",
      "members": [
        "Rahul Sharma",
        "David Miller"
      ],
      "createdBy": "Sarah Chen",
      "visibility": "team"
    },
    {
      "id": "proj-3",
      "title": "Core HRMS Platform",
      "desc": "Multi-tiered Time Office ledger, statutory register DAG, and automated payroll generation engine.",
      "progress": 88,
      "color": "#2DD4A8",
      "due": "Mar 30",
      "members": [
        "Priya Nair",
        "Trisha Khanna",
        "Amit Verma"
      ],
      "createdBy": "Amit Verma",
      "visibility": "all"
    }
  ],
  "kanbanTasks_76": {
    "todo": [
      {
        "id": "t1",
        "title": "Vedic Energy Scheduler Algorithm",
        "tag": "AI/Wellness",
        "assignee": "Trisha Khanna",
        "project": "Website Redesign",
        "priority": "Medium",
        "due": "2d"
      },
      {
        "id": "t2",
        "title": "Multi-Tenant Partition Testing",
        "tag": "Cloud",
        "assignee": "David Miller",
        "project": "Website Redesign",
        "priority": "High",
        "due": "3d"
      }
    ],
    "inprogress": [
      {
        "id": "t3",
        "title": "11 Module Frontend Component Suite",
        "tag": "Dev",
        "assignee": "Priya Nair",
        "project": "Website Redesign",
        "priority": "Urgent",
        "due": "Today"
      },
      {
        "id": "t4",
        "title": "9-Box Talent Calibration Matrix UI",
        "tag": "Design",
        "assignee": "Rahul Sharma",
        "project": "Website Redesign",
        "priority": "Medium",
        "due": "Tomorrow"
      },
      {
        "id": "t-m1",
        "title": "Push Notification Gateway Setup",
        "tag": "Dev",
        "assignee": "David Miller",
        "project": "Mobile App Launch",
        "priority": "High",
        "due": "In 4 days"
      }
    ],
    "review": [
      {
        "id": "t5",
        "title": "Pre-Payroll DAG Calculation Audit Engine",
        "tag": "Payroll",
        "assignee": "Priya Nair",
        "project": "Website Redesign",
        "priority": "High",
        "due": "Ready"
      }
    ],
    "done": [
      {
        "id": "t6",
        "title": "Zero-Trust Architecture & Auth Integration",
        "tag": "Security",
        "assignee": "Trisha Khanna",
        "project": "Website Redesign",
        "priority": "Low",
        "due": "Completed"
      }
    ]
  },
  "fallback_26": "New Task",
  "fallback_27": "General",
  "fallback_28": "Priya Nair",
  "fallback_29": "Website Redesign",
  "fallback_30": "In 3 days",
  "fallback_31": "Medium",
  "fallback_32": "New Project",
  "fallback_33": "Sprint deliverables and milestone tracking.",
  "fallback_34": "#2DD4A8",
  "fallback_35": "In 30 days",
  "members_77": [
    "Priya Nair"
  ],
  "fallback_36": "Amit Verma",
  "fallback_37": "team",
  "focusTasks_78": [
    {
      "id": 1,
      "title": "[HIGH] Review 360-degree performance feedback for sprint Q1",
      "time": "04:00 PM",
      "urgency": "high",
      "done": false
    },
    {
      "id": 2,
      "title": "[MEDIUM] Deep Work block: Vedic Pitta energy cycle",
      "time": "11:00 AM",
      "urgency": "med",
      "done": false
    }
  ],
  "completeFocusTask_fields_79": {
    "done": true
  },
  "settings_80": {
    "emailNotif": true,
    "pushNotif": true,
    "twoFactor": true,
    "vedicRhythmEnabled": true,
    "aiProactiveNudges": true,
    "multiCurrency": "INR (₹)"
  },
  "announcements_81": [
    {
      "id": "ANN-01",
      "title": "Welcome to Nucleus Platform 2.0",
      "content": "We have updated our internal workspace with enhanced role-based capabilities, instant 0-fee EWA payroll disbursals, and predictive people intelligence.",
      "category": "Platform Update",
      "pinned": true,
      "author": "HR Operations",
      "date": "Yesterday, 04:30 PM",
      "audience": "All Company",
      "status": "Published"
    },
    {
      "id": "ANN-02",
      "title": "Policy Update: Hybrid & Remote Work Guidelines 2026",
      "content": "Revised 3-2 hybrid guidelines effective from 1st March. Managers are requested to synchronize pod schedules in the Pod Directory.",
      "category": "Policy",
      "pinned": false,
      "author": "Diksha (People Ops)",
      "date": "2 days ago",
      "audience": "All Company",
      "status": "Published"
    },
    {
      "id": "ANN-03",
      "title": "Quarterly Town Hall & Hackathon Kickoff",
      "content": "Join us this Friday at 4 PM IST for our Q1 All-Hands Townhall followed by the announcement of the 2026 AI Innovation Hackathon.",
      "category": "Town Hall",
      "pinned": false,
      "author": "Leadership Team",
      "date": "3 days ago",
      "audience": "Engineering & Product",
      "status": "Published"
    }
  ],
  "item_fields_82": {
    "date": "Just now",
    "status": "Published"
  },
  "policyDocuments_83": [],
  "effectiveDate_85": {
    "day": "2-digit",
    "month": "short",
    "year": "numeric"
  },
  "item_fields_84": {
    "fileSize": "1.2 MB",
    "format": "PDF",
    "author": "HR Admin"
  },
  "misMasterData_86": [
    {
      "empId": "EMP-101",
      "name": "Trisha Khanna",
      "dept": "Engineering",
      "pod": "UI / UX & Frontend",
      "role": "Senior Platform Architect",
      "tenure": "2.4 yrs",
      "shift": "General (09:30-18:30)",
      "presentDays": 21,
      "attendancePct": 95.4,
      "overtimeHrs": 14.5,
      "leaveBalance": 14,
      "grossCtc": "₹ 28,00,000",
      "variableBonus": "₹ 2,40,000",
      "performanceRating": "4.8 / 5.0 (Top Exceeds)",
      "attritionRisk": "Low (4%)",
      "status": "Active"
    },
    {
      "empId": "EMP-102",
      "name": "Amit Verma",
      "dept": "Engineering",
      "pod": "Core Platform & Architecture",
      "role": "Director of Engineering",
      "tenure": "4.1 yrs",
      "shift": "General (09:00-18:00)",
      "presentDays": 22,
      "attendancePct": 98.2,
      "overtimeHrs": 8,
      "leaveBalance": 18,
      "grossCtc": "₹ 45,00,000",
      "variableBonus": "₹ 5,00,000",
      "performanceRating": "4.9 / 5.0 (Role Model)",
      "attritionRisk": "Low (2%)",
      "status": "Active"
    },
    {
      "empId": "EMP-103",
      "name": "Sarah Chen",
      "dept": "Product",
      "pod": "Product Strategy & Growth",
      "role": "Lead Product Manager",
      "tenure": "3.6 yrs",
      "shift": "Singapore (08:00-17:00)",
      "presentDays": 20,
      "attendancePct": 91,
      "overtimeHrs": 12,
      "leaveBalance": 11,
      "grossCtc": "$ 140,000",
      "variableBonus": "$ 18,000",
      "performanceRating": "4.6 / 5.0 (Exceeds)",
      "attritionRisk": "Medium (18%)",
      "status": "Active"
    },
    {
      "empId": "EMP-104",
      "name": "Rahul Saxena",
      "dept": "Design",
      "pod": "UI / UX & Design Pod",
      "role": "Senior UX Designer",
      "tenure": "2.2 yrs",
      "shift": "General (10:00-19:00)",
      "presentDays": 21,
      "attendancePct": 95,
      "overtimeHrs": 6.5,
      "leaveBalance": 16,
      "grossCtc": "₹ 22,00,000",
      "variableBonus": "₹ 1,80,000",
      "performanceRating": "4.4 / 5.0 (Meets High)",
      "attritionRisk": "Low (5%)",
      "status": "Active"
    },
    {
      "empId": "EMP-105",
      "name": "Priya Nair",
      "dept": "Engineering",
      "pod": "Core Platform & Architecture",
      "role": "Full Stack Engineer",
      "tenure": "1.5 yrs",
      "shift": "General (09:00-18:00)",
      "presentDays": 19,
      "attendancePct": 86.4,
      "overtimeHrs": 18,
      "leaveBalance": 8,
      "grossCtc": "₹ 16,50,000",
      "variableBonus": "₹ 1,20,000",
      "performanceRating": "4.2 / 5.0 (Meets)",
      "attritionRisk": "High (34%)",
      "status": "Active"
    },
    {
      "empId": "EMP-106",
      "name": "David Miller",
      "dept": "Infrastructure",
      "pod": "Cloud Ops & Security",
      "role": "Senior DevOps Architect",
      "tenure": "3.9 yrs",
      "shift": "UK Shift (13:30-22:30)",
      "presentDays": 22,
      "attendancePct": 99.1,
      "overtimeHrs": 22,
      "leaveBalance": 20,
      "grossCtc": "£ 88,000",
      "variableBonus": "£ 9,500",
      "performanceRating": "4.7 / 5.0 (Exceeds)",
      "attritionRisk": "Low (6%)",
      "status": "Active"
    },
    {
      "empId": "EMP-107",
      "name": "Ananya Sharma",
      "dept": "Human Resources",
      "pod": "Talent & People Ops",
      "role": "HR Business Partner",
      "tenure": "1.8 yrs",
      "shift": "General (09:00-18:00)",
      "presentDays": 21,
      "attendancePct": 95.5,
      "overtimeHrs": 4,
      "leaveBalance": 15,
      "grossCtc": "₹ 18,00,000",
      "variableBonus": "₹ 1,50,000",
      "performanceRating": "4.5 / 5.0 (Exceeds)",
      "attritionRisk": "Low (8%)",
      "status": "Active"
    },
    {
      "empId": "EMP-108",
      "name": "Vikram Joshi",
      "dept": "Finance",
      "pod": "Finance & Compliance",
      "role": "Finance & Payroll Specialist",
      "tenure": "2.9 yrs",
      "shift": "General (09:30-18:30)",
      "presentDays": 22,
      "attendancePct": 98,
      "overtimeHrs": 16,
      "leaveBalance": 13,
      "grossCtc": "₹ 20,50,000",
      "variableBonus": "₹ 2,00,000",
      "performanceRating": "4.6 / 5.0 (Exceeds)",
      "attritionRisk": "Low (3%)",
      "status": "Active"
    }
  ],
  "defaultValue_11": "external_dataset.xlsx",
  "workflows_87": [],
  "defaultValue_12": "SAP S/4HANA (BAPI_EMPLOYEE_GETDATA)",
  "inboundBatch_88": [
    {
      "id": "EMP001",
      "costCenterCode": "CC-101",
      "gradeBand": "L5",
      "designation": "Senior Principal Architect"
    },
    {
      "id": "EMP004",
      "costCenterCode": "CC-102",
      "bankAccountNumber": "HDFC00018449102"
    },
    {
      "id": "EMP007",
      "costCenterCode": "CC-201",
      "overtimeHours": 0,
      "biometricPunches": [
        "10:00"
      ]
    },
    {
      "id": "EMP009",
      "gradeBand": "E6",
      "designation": "VP Technology"
    }
  ],
  "defaultValue_13": "SAP S/4HANA",
  "dispatchGLPostingBatch_fields_89": {
    "status": "ACKNOWLEDGED"
  },
  "dispatchGLPostingBatch_fields_90": {
    "reconciledBy": "Pending Month-End Close"
  },
  "reconcileGLBatch_fields_91": {
    "status": "RECONCILED"
  },
  "fallback_38": "Finance Controller",
  "fallback_39": "10:00 AM",
  "fallback_40": "Plant Unit-1 (Shop Floor)",
  "fallback_41": "Shop Floor Operator",
  "fallback_42": "TK-0199",
  "fallback_43": 35,
  "fallback_44": "Male",
  "fallback_45": "Operator",
  "fallback_46": "Contusion / First Aid",
  "fallback_47": "Equipment handling incident",
  "fallback_48": 1,
  "newRecord_fields_92": {
    "reportedToInspector": true
  },
  "fallback_49": "R. K. Nair (Factory Safety Manager)",
  "fallback_50": "Immediate SOP reinforcement and PPE checklist verification.",
  "fallback_51": "Senior Inspector of Factories",
  "fallback_52": "Directorate of Industrial Safety & Health",
  "fallback_53": "Statutory records inspected and verified compliant.",
  "fallback_54": "None. Maintain current standard.",
  "fallback_55": "CLOSED",
  "fallback_56": "Pradeep Shenoy (Works Director)",
  "targetEmp_fields_93": {
    "name": "Selected Employee",
    "department": "Plant Operations"
  }
};

export function getHrmsDefault(key, fallback = null) {
  return HRMS_DEFAULTS[key] !== undefined ? structuredClone(HRMS_DEFAULTS[key]) : fallback;
}
