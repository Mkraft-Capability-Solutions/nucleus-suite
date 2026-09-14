/**
 * Contingent Workforce & Contractor Management Domain Service (CON)
 * Supports:
 * - Vendor / Staffing Agency Registry (FRM-CON-01)
 * - Contractor Lifecycle & Compliance Clearance (FRM-CON-02)
 * - SOW Milestones & Timesheet Invoicing
 */

export interface StaffingVendor {
  id: string;
  vendorCode: string;
  agencyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  activeContractorsCount: number;
  complianceTier: 'Tier-1 Certified' | 'Tier-2 Verified' | 'Conditional';
  contractValidUntil: string;
  status: 'Active' | 'Under Audit' | 'Suspended';
}

export interface ContractorRecord {
  id: string;
  contractorCode: string;
  fullName: string;
  vendorId: string;
  vendorName: string;
  podOrDepartment: string;
  reportingManager: string;
  hourlyRate: number;
  currency: string;
  sowNumber: string;
  startDate: string;
  endDate: string;
  bgvStatus: 'Verified' | 'In Progress' | 'Flagged';
  complianceGatePass: boolean;
  status: 'Active' | 'Extended' | 'Completed' | 'Terminated';
}

export interface ContractorInvoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  billingMonth: string; // e.g. '2026-08'
  totalHours: number;
  totalAmount: number;
  currency: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Paid';
  approvedBy?: string;
  paidAt?: string;
}

const mockVendors: StaffingVendor[] = [
  {
    id: 'VND-01',
    vendorCode: 'VND-TALENT-X',
    agencyName: 'TalentX Global Staffing Solutions',
    contactPerson: 'Suresh Raina',
    email: 'accounts@talentx.example.com',
    phone: '+91 80 4455 6677',
    activeContractorsCount: 42,
    complianceTier: 'Tier-1 Certified',
    contractValidUntil: '2027-03-31',
    status: 'Active'
  },
  {
    id: 'VND-02',
    vendorCode: 'VND-CYBER-OPS',
    agencyName: 'CyberOps Infra Contingent Partners',
    contactPerson: 'Farhan Akhtar',
    email: 'partners@cyberops.example.com',
    phone: '+91 20 6677 8899',
    activeContractorsCount: 18,
    complianceTier: 'Tier-1 Certified',
    contractValidUntil: '2026-12-31',
    status: 'Active'
  }
];

const mockContractors: ContractorRecord[] = [
  {
    id: 'CON-101',
    contractorCode: 'CNT-2026-041',
    fullName: 'David K. Miller',
    vendorId: 'VND-01',
    vendorName: 'TalentX Global Staffing Solutions',
    podOrDepartment: 'Engineering & Architecture',
    reportingManager: 'Dr. Priya Sundaram',
    hourlyRate: 3500,
    currency: 'INR',
    sowNumber: 'SOW-AST-ENG-2026-04',
    startDate: '2026-02-01',
    endDate: '2026-11-30',
    bgvStatus: 'Verified',
    complianceGatePass: true,
    status: 'Active'
  },
  {
    id: 'CON-102',
    contractorCode: 'CNT-2026-077',
    fullName: 'Sneha Roy',
    vendorId: 'VND-02',
    vendorName: 'CyberOps Infra Contingent Partners',
    podOrDepartment: 'DevOps & Cloud Infra',
    reportingManager: 'Vikramaditya Rao',
    hourlyRate: 2800,
    currency: 'INR',
    sowNumber: 'SOW-AST-OPS-2026-11',
    startDate: '2026-05-15',
    endDate: '2026-12-31',
    bgvStatus: 'Verified',
    complianceGatePass: true,
    status: 'Active'
  }
];

export class ContractWorkforceService {
  private static vendors: StaffingVendor[] = [...mockVendors];
  private static contractors: ContractorRecord[] = [...mockContractors];
  private static invoices: ContractorInvoice[] = [];

  public static async getVendors(): Promise<StaffingVendor[]> {
    return [...this.vendors];
  }

  public static async getContractors(vendorId?: string): Promise<ContractorRecord[]> {
    if (vendorId) {
      return this.contractors.filter(c => c.vendorId === vendorId);
    }
    return [...this.contractors];
  }

  public static async createContractor(contractor: Omit<ContractorRecord, 'id' | 'contractorCode' | 'status'>): Promise<ContractorRecord> {
    const nextSeq = this.contractors.length + 1;
    const newContractor: ContractorRecord = {
      ...contractor,
      id: `CON-${String(nextSeq).padStart(3, '0')}`,
      contractorCode: `CNT-2026-${String(nextSeq).padStart(3, '0')}`,
      status: 'Active'
    };
    this.contractors.push(newContractor);
    return newContractor;
  }

  public static async submitInvoice(invoice: Omit<ContractorInvoice, 'id' | 'status'>): Promise<ContractorInvoice> {
    const newInvoice: ContractorInvoice = {
      ...invoice,
      id: `INV-${Date.now()}`,
      status: 'Submitted'
    };
    this.invoices.push(newInvoice);
    return newInvoice;
  }

  public static async getContractorStats(): Promise<{ totalActiveContractors: number; totalVendors: number; monthlySpendINR: number; complianceRatePercent: number }> {
    return {
      totalActiveContractors: this.contractors.filter(c => c.status === 'Active').length,
      totalVendors: this.vendors.length,
      monthlySpendINR: 8450000,
      complianceRatePercent: 98.5
    };
  }
}

export default ContractWorkforceService;
