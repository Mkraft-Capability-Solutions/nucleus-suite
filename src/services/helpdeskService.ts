/**
 * Enterprise Helpdesk & Service Desk Domain Service (HLP)
 * Supports:
 * - Ticket Creation & Management (FRM-HLP-01)
 * - SLA Monitoring & Priority Routing (FRM-HLP-02)
 * - Category Routing & Resolution Escalations
 */

export interface HelpdeskTicket {
  id: string;
  ticketCode: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  category: 'IT Hardware & Access' | 'Payroll & Tax' | 'Leave & Attendance' | 'Workplace & Facilities' | 'HR Operations' | 'Benefits & Insurance';
  subject: string;
  description: string;
  priority: 'P1 - Critical (4h SLA)' | 'P2 - High (8h SLA)' | 'P3 - Medium (24h SLA)' | 'P4 - Low (48h SLA)';
  status: 'Open' | 'In Progress' | 'Pending User Info' | 'Resolved' | 'Closed';
  assignedAgent?: string;
  slaBreachHours?: number;
  isBreached: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

const mockTickets: HelpdeskTicket[] = [
  {
    id: 'TCK-001',
    ticketCode: 'HLP-IT-2026-081',
    requesterId: 'AST-1120',
    requesterName: 'Aditya Sen',
    requesterEmail: 'aditya.sen@asteria.space',
    department: 'Engineering & Architecture',
    category: 'IT Hardware & Access',
    subject: 'VPN Tunnel Token & GitHub Enterprise SSO Access Grant',
    description: 'Require SSH keys added to Asteria Cloud Core pod repository.',
    priority: 'P2 - High (8h SLA)',
    status: 'In Progress',
    assignedAgent: 'Sameer Joshi (IT SecOps)',
    isBreached: false,
    createdAt: '2026-09-14T08:30:00Z'
  },
  {
    id: 'TCK-002',
    ticketCode: 'HLP-HR-2026-042',
    requesterId: 'AST-1088',
    requesterName: 'Kavita Krishnan',
    requesterEmail: 'kavita.k@asteria.space',
    department: 'Product & UX Design',
    category: 'Benefits & Insurance',
    subject: 'Health Insurance E-Card Download & Dependant Name Addition',
    description: 'Need to add newborn baby to the corporate GMC medical policy.',
    priority: 'P3 - Medium (24h SLA)',
    status: 'Open',
    assignedAgent: 'Meera Nambiar (Benefits Lead)',
    isBreached: false,
    createdAt: '2026-09-14T09:15:00Z'
  }
];

export class HelpdeskService {
  private static tickets: HelpdeskTicket[] = [...mockTickets];

  public static async getTickets(filters?: { category?: string; status?: string; requesterId?: string }): Promise<HelpdeskTicket[]> {
    let list = [...this.tickets];
    if (filters?.category && filters.category !== 'All') {
      list = list.filter(t => t.category === filters.category);
    }
    if (filters?.status && filters.status !== 'All') {
      list = list.filter(t => t.status === filters.status);
    }
    if (filters?.requesterId) {
      list = list.filter(t => t.requesterId === filters.requesterId);
    }
    return list;
  }

  public static async createTicket(ticket: Omit<HelpdeskTicket, 'id' | 'ticketCode' | 'isBreached' | 'createdAt'>): Promise<HelpdeskTicket> {
    const nextSeq = this.tickets.length + 1;
    const catCode = ticket.category.includes('IT') ? 'IT' : ticket.category.includes('Payroll') ? 'PAY' : 'HR';
    const newTicket: HelpdeskTicket = {
      ...ticket,
      id: `TCK-${String(nextSeq).padStart(3, '0')}`,
      ticketCode: `HLP-${catCode}-2026-${String(nextSeq).padStart(3, '0')}`,
      isBreached: false,
      createdAt: new Date().toISOString()
    };
    this.tickets.unshift(newTicket);
    return newTicket;
  }

  public static async updateTicketStatus(ticketId: string, status: HelpdeskTicket['status'], resolutionNotes?: string): Promise<HelpdeskTicket | null> {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = status;
    if (status === 'Resolved' || status === 'Closed') {
      ticket.resolvedAt = new Date().toISOString();
      if (resolutionNotes) ticket.resolutionNotes = resolutionNotes;
    }
    return ticket;
  }

  public static async assignAgent(ticketId: string, agentName: string): Promise<HelpdeskTicket | null> {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return null;
    ticket.assignedAgent = agentName;
    if (ticket.status === 'Open') ticket.status = 'In Progress';
    return ticket;
  }

  public static async getHelpdeskStats(): Promise<{ open: number; inProgress: number; resolved: number; breaches: number; avgResolutionHours: number }> {
    return {
      open: this.tickets.filter(t => t.status === 'Open').length,
      inProgress: this.tickets.filter(t => t.status === 'In Progress').length,
      resolved: this.tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
      breaches: this.tickets.filter(t => t.isBreached).length,
      avgResolutionHours: 4.8
    };
  }
}

export default HelpdeskService;
