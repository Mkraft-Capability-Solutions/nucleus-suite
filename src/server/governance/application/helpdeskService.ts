import { sqlClient } from '@/lib/db';
import { helpdeskTickets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { HelpdeskTicket, helpdeskTicketSchema } from '../core/models';

export class HelpdeskService {
  
  public static async getTicketsForEmployee(tenantId: string, employeeId: string) {
    const records = await sqlClient
      .select()
      .from(helpdeskTickets)
      .where(and(
        eq(helpdeskTickets.tenantId, tenantId),
        eq(helpdeskTickets.employeeId, employeeId as any)
      ));
      
    return records;
  }

  public static async createTicket(tenantId: string, input: Omit<HelpdeskTicket, 'tenantId'>) {
    const payload = helpdeskTicketSchema.parse({ ...input, tenantId });

    const [savedRecord] = await sqlClient.insert(helpdeskTickets).values({
      tenantId: payload.tenantId,
      employeeId: payload.employeeId,
      issueType: payload.issueType,
      priority: payload.priority,
      status: payload.status,
    } as any).returning();

    return savedRecord;
  }
}
