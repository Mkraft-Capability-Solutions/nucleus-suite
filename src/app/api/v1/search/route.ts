import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { listEmployees } from "@/server/organization/service";
import navigationCatalog from "@/config/ui/navigation.catalog.json";
import operationalRegistry from "@/config/ui/lib.operational-module-registry.json";

export const dynamic = "force-dynamic";

type FlatCatalogItem = {
  id: string;
  label: string;
  targetTab: string;
  desc?: string;
  tag?: string;
  domainLabel?: string;
  domainId?: string;
  groupHeading?: string;
};

type RegistryField = {
  key?: string;
  label?: string;
  type?: string;
  control?: string;
  dataType?: string;
  section?: string;
  validation?: string;
};

type RegistryModule = {
  id: string;
  screenId?: string;
  formId?: string;
  title?: string;
  primary?: string;
  endpoint?: string;
  fields?: RegistryField[];
};

type SearchDocument = {
  id: string;
  title: string;
  category: string;
  desc: string;
  targetTab: string;
  subFeature?: string;
  domain?: string;
  keywords: string[];
};

// Flatten navigation catalog items for quick lookup
const catalogItems: FlatCatalogItem[] = [];
if (Array.isArray((navigationCatalog as { domains?: unknown[] })?.domains)) {
  for (const domain of (navigationCatalog as { domains: Array<{ id?: string; label?: string; groups?: Array<{ heading?: string; items?: FlatCatalogItem[] }> }> }).domains) {
    if (Array.isArray(domain.groups)) {
      for (const group of domain.groups) {
        if (Array.isArray(group.items)) {
          for (const item of group.items) {
            catalogItems.push({
              ...item,
              domainId: domain.id,
              domainLabel: domain.label,
              groupHeading: group.heading,
            });
          }
        }
      }
    }
  }
}

// Operational modules with formId and screenId
const registryModules: RegistryModule[] = (operationalRegistry as { modules?: RegistryModule[] })?.modules || [];

// Curated document templates and statutory forms
const STATIC_DOCUMENTS: SearchDocument[] = [
  {
    id: "doc-form-16",
    title: "Form 16 (TDS Certificate)",
    category: "Statutory Tax Document",
    desc: "Annual certificate of tax deducted at source under IT Act",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["form 16", "tds", "tax", "income tax", "it act", "certificate", "withholding"]
  },
  {
    id: "doc-form-12bb",
    title: "Form 12BB (Investment & Exemption Declaration)",
    category: "Statutory Tax Declaration",
    desc: "Statement of claims for tax deductions under Chapter VI-A & HRA",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["form 12bb", "investment", "tax declaration", "hra", "80c", "deductions"]
  },
  {
    id: "doc-form-11",
    title: "Form 11 (EPF Combined Declaration)",
    category: "Provident Fund",
    desc: "Declaration form for Employees' Provident Fund (EPFO)",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["form 11", "epf", "pf", "epfo", "provident fund", "uan"]
  },
  {
    id: "doc-form-2",
    title: "Form 2 (Nomination & Declaration for PF / Gratuity)",
    category: "Statutory Nomination",
    desc: "Declaration and nomination form under EPF and Gratuity schemes",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["form 2", "nomination", "gratuity", "pf nomination", "beneficiary"]
  },
  {
    id: "doc-offer-letter",
    title: "Employment Offer Letter Template",
    category: "Talent & Onboarding",
    desc: "Official employment offer letter with compensation Annexure",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["offer", "offer letter", "appointment", "candidacy", "compensation letter"]
  },
  {
    id: "doc-appointment-letter",
    title: "Appointment & Joining Letter",
    category: "Core HR Document",
    desc: "Formal confirmation of appointment with terms of employment",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["appointment", "appointment letter", "joining", "employment agreement"]
  },
  {
    id: "doc-nda",
    title: "Non-Disclosure & Confidentiality Agreement (NDA)",
    category: "Compliance & Legal",
    desc: "Proprietary information and confidentiality agreement",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["nda", "confidentiality", "non disclosure", "ip agreement", "legal"]
  },
  {
    id: "doc-relieving-letter",
    title: "Relieving & Experience Certificate",
    category: "Separation & Exit",
    desc: "Service certificate and relieving letter upon separation",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["relieving", "experience", "experience certificate", "exit letter", "service certificate"]
  },
  {
    id: "doc-payslips",
    title: "Monthly Salary Payslip Archives",
    category: "Payroll & Compensation",
    desc: "Itemized earnings, deductions, PF, ESI, and net pay statements",
    targetTab: "payroll_records",
    subFeature: "payroll_records",
    domain: "payroll_finance",
    keywords: ["payslip", "pay slip", "salary slip", "salary statement", "wage slip", "earnings"]
  },
  {
    id: "doc-identity-proof",
    title: "Government Identity Proof (Aadhaar / Passport / Voter ID)",
    category: "Identity & Verification",
    desc: "Primary national identification document records",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["aadhaar", "passport", "voter id", "id proof", "identity", "kyc"]
  },
  {
    id: "doc-pan-card",
    title: "PAN Card Copy & Verification Record",
    category: "Tax Identification",
    desc: "Permanent Account Number record for tax and payroll processing",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["pan", "pan card", "tax id", "permanent account number"]
  },
  {
    id: "doc-hr-policy-handbook",
    title: "Company HR Policy Manual & Employee Handbook",
    category: "Governance & Policies",
    desc: "Comprehensive company guidelines, code of conduct, and workplace norms",
    targetTab: "policy_acknowledgements",
    subFeature: "policy_acknowledgements",
    domain: "core_hr",
    keywords: ["policy", "handbook", "code of conduct", "hr policy", "guidelines", "regulations"]
  },
  {
    id: "doc-posh-policy",
    title: "POSH Policy (Prevention of Sexual Harassment)",
    category: "Compliance & Safety",
    desc: "Internal Complaints Committee (ICC) framework and POSH guidelines",
    targetTab: "policy_acknowledgements",
    subFeature: "policy_acknowledgements",
    domain: "core_hr",
    keywords: ["posh", "sexual harassment", "icc", "workplace safety", "compliance"]
  },
  {
    id: "doc-medical-insurance",
    title: "Group Health & Medical Insurance E-Card",
    category: "Benefits & Wellness",
    desc: "Corporate medical policy coverage, TPA details, and cashless claim guide",
    targetTab: "document_vault",
    subFeature: "document_vault",
    domain: "core_hr",
    keywords: ["insurance", "medical", "mediclaim", "health card", "tpa", "cashless"]
  }
];

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    if (query.length < 2) {
      return Response.json({ data: [], meta: { requestId, query } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }

    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/[\s·\-_,]+/).filter(Boolean);

    const matchesAllTokens = (text?: string | null) => {
      if (!text) return false;
      const lower = text.toLowerCase();
      return queryTokens.every((token) => lower.includes(token));
    };

    const matchesAnyToken = (text?: string | null) => {
      if (!text) return false;
      const lower = text.toLowerCase();
      return queryTokens.some((token) => lower.includes(token));
    };

    // 1. Matched Forms (§ FRM-xxx) from Operational Registry
    const matchedForms = registryModules
      .filter((mod) => {
        const formIdMatch = mod.formId && (mod.formId.toLowerCase().includes(lowerQuery) || matchesAllTokens(mod.formId));
        const titleMatch = mod.title && (mod.title.toLowerCase().includes(lowerQuery) || matchesAllTokens(mod.title));
        const fieldMatch = mod.fields?.some((f) => matchesAllTokens(f.label) || matchesAllTokens(f.key));
        return formIdMatch || titleMatch || fieldMatch;
      })
      .slice(0, 6)
      .map((mod) => ({
        id: mod.formId || mod.id,
        type: "form",
        title: `§ ${mod.formId || mod.id} · ${mod.title}`,
        subtitle: `${mod.screenId ? `${mod.screenId} · ` : ""}${mod.fields?.length || 0} fields · ${mod.primary || ""}`,
        targetTab: mod.id,
        subFeature: mod.id,
        domain: mod.primary,
        tag: mod.formId || "FORM",
      }));

    // 2. Matched Screens (SCR-xxx) from Operational Registry
    const matchedScreens = registryModules
      .filter((mod) => {
        if (!mod.screenId) return false;
        return (
          mod.screenId.toLowerCase().includes(lowerQuery) ||
          (lowerQuery.startsWith("scr") && mod.screenId.toLowerCase().replace(/[^a-z0-9]/g, "").includes(lowerQuery.replace(/[^a-z0-9]/g, "")))
        );
      })
      .slice(0, 4)
      .map((mod) => ({
        id: mod.screenId!,
        type: "screen",
        title: `${mod.screenId} · ${mod.title}`,
        subtitle: `Form: ${mod.formId || "N/A"} · ${mod.fields?.length || 0} fields`,
        targetTab: mod.id,
        subFeature: mod.id,
        domain: mod.primary,
        tag: mod.screenId,
      }));

    // 3. Matched Menus & Submenus from Navigation Catalog
    const matchedSubmenus = catalogItems
      .filter((item) =>
        item.label?.toLowerCase().includes(lowerQuery) ||
        matchesAllTokens(item.label) ||
        item.desc?.toLowerCase().includes(lowerQuery) ||
        item.groupHeading?.toLowerCase().includes(lowerQuery) ||
        item.tag?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        type: "submenu",
        title: item.label,
        subtitle: [item.domainLabel, item.groupHeading, item.desc].filter(Boolean).join(" · "),
        targetTab: item.targetTab,
        subFeature: item.id,
        domain: item.domainId,
        tag: item.tag || "SUBMENU",
      }));

    // 4. Matched Documents
    const matchedDocuments = STATIC_DOCUMENTS
      .filter((doc) =>
        doc.title.toLowerCase().includes(lowerQuery) ||
        matchesAllTokens(doc.title) ||
        doc.category.toLowerCase().includes(lowerQuery) ||
        doc.desc.toLowerCase().includes(lowerQuery) ||
        doc.keywords.some((kw) => kw.includes(lowerQuery) || matchesAnyToken(kw))
      )
      .slice(0, 4)
      .map((doc) => ({
        id: doc.id,
        type: "document",
        title: doc.title,
        subtitle: `${doc.category} · ${doc.desc}`,
        targetTab: doc.targetTab,
        subFeature: doc.subFeature,
        domain: doc.domain,
        tag: "DOCUMENT",
      }));

    // 5. Matched Employees from live directory
    const employees = await listEmployees(access, { search: query, page: 1, pageSize: 6 });
    const matchedEmployees = employees.items.map((employee) => ({
      id: employee.id,
      type: "employee",
      title: `${employee.first_name} ${employee.last_name}`.trim(),
      subtitle: [employee.employee_code, employee.designation, employee.department].filter(Boolean).join(" · "),
      targetTab: "people_core",
      subFeature: employee.id,
      domain: "workforce",
      tag: employee.employee_code || "EMPLOYEE",
    }));

    // Deduplicate results by targetTab/id while preserving distinct types
    const seen = new Set<string>();
    const combinedResults = [
      ...matchedForms,
      ...matchedScreens,
      ...matchedSubmenus,
      ...matchedDocuments,
      ...matchedEmployees,
    ].filter((item) => {
      const key = `${item.type}:${item.id}:${item.targetTab || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return Response.json({
      data: combinedResults,
      meta: {
        requestId,
        query,
        total: combinedResults.length,
        breakdown: {
          forms: matchedForms.length,
          screens: matchedScreens.length,
          submenus: matchedSubmenus.length,
          documents: matchedDocuments.length,
          employees: matchedEmployees.length,
        },
      },
    }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

