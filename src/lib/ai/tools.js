import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Layer 4: RAG/Tools Layer
 * Interactions with the "Real World" (Database & External Services)
 */
export const tools = {
    /**
     * Fetch attendance status for a user
     */
    getAttendance: async (email) => {
        // In a real app, fetch from Attendance table. 
        // For now, we'll return a mock status based on the user's existence
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return "User not found.";

        // Mock data
        return {
            status: 'Present',
            punchIn: '09:00 AM',
            totalHours: '4h 30m'
        };
    },

    /**
     * Fetch leave balance
     */
    getLeaves: async (email) => {
        return {
            privilege: 12,
            casual: 6,
            sick: 4
        };
    },

    /**
     * Fetch payroll info (sensitive)
     */
    getPayroll: async (email) => {
        return {
            lastMonthPayout: '28th Feb',
            netPay: '₹75,000',
            status: 'Processed'
        };
    },

    /**
     * Search policies (Mock RAG)
     */
    searchPolicy: async (query) => {
        const policies = [
            { topic: 'leave', content: 'Employees are entitled to 12 privilege leaves per year.' },
            { topic: 'wfh', content: 'Remote work is allowed for 2 days a week with manager approval.' },
            { topic: 'attendance', content: 'Core hours are 10 AM to 4 PM. Minimum 9 hours required.' }
        ];

        const output = policies.filter(p => query.toLowerCase().includes(p.topic));
        return output.length > 0 ? output : "No specific policy found for this topic.";
    }
};
