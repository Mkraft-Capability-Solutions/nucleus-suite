import { z } from 'zod';

export const helpdeskTicketSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  issueType: z.string().min(2),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type HelpdeskTicket = z.infer<typeof helpdeskTicketSchema>;
