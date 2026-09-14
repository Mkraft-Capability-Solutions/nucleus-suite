import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { listEmployees } from "@/server/organization/service";
import navigationCatalog from "@/config/ui/navigation.catalog.json";

export const dynamic = "force-dynamic";

type FlatCatalogItem = {
  id: string;
  label: string;
  targetTab: string;
  desc?: string;
  tag?: string;
  domainLabel?: string;
};

// Flatten navigation catalog items for quick lookup
const catalogItems: FlatCatalogItem[] = [];
if (Array.isArray((navigationCatalog as { domains?: unknown[] })?.domains)) {
  for (const domain of (navigationCatalog as { domains: Array<{ label?: string; groups?: Array<{ items?: FlatCatalogItem[] }> }> }).domains) {
    if (Array.isArray(domain.groups)) {
      for (const group of domain.groups) {
        if (Array.isArray(group.items)) {
          for (const item of group.items) {
            catalogItems.push({ ...item, domainLabel: domain.label });
          }
        }
      }
    }
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    if (query.length < 2) {
      return Response.json({ data: [], meta: { requestId, query } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }

    const lowerQuery = query.toLowerCase();

    // 1. Matched modules from navigation catalog
    const matchedModules = catalogItems
      .filter((item) =>
        item.label?.toLowerCase().includes(lowerQuery) ||
        item.desc?.toLowerCase().includes(lowerQuery) ||
        item.tag?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        type: "module",
        title: item.label,
        subtitle: [item.domainLabel, item.desc].filter(Boolean).join(" · "),
        targetTab: item.targetTab,
        subFeature: item.id,
        tag: item.tag,
      }));

    // 2. Matched employees from database
    const employees = await listEmployees(access, { search: query, page: 1, pageSize: 8 });
    const matchedEmployees = employees.items.map((employee) => ({
      id: employee.id,
      type: "employee",
      title: `${employee.first_name} ${employee.last_name}`.trim(),
      subtitle: [employee.employee_code, employee.designation, employee.department].filter(Boolean).join(" · "),
      href: `/people?employee=${encodeURIComponent(employee.id)}`,
    }));

    return Response.json({
      data: [...matchedModules, ...matchedEmployees],
      meta: { requestId, query, total: matchedModules.length + employees.total },
    }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
