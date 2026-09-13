import { tools } from './tools';
import { PROMPTS } from './prompts';

/**
 * Layer 2: Agent Layer
 * The Intelligence Router / Brain
 */
export class Agent {
    constructor(userId) {
        this.userId = userId;
    }

    async process(input) {
        const lowerInput = input.toLowerCase();

        // 1. Intent Classification (Rule-based Mock)
        // In a real LLM, we'd send PROMPTS.INTENT_CLASSIFICATION + input

        let intent = 'CHAT';
        if (lowerInput.includes('show') || lowerInput.includes('go to') || lowerInput.includes('open')) {
            intent = 'NAVIGATION';
        } else if (lowerInput.includes('leave') || lowerInput.includes('balance') || lowerInput.includes('attendance') || lowerInput.includes('salary')) {
            intent = 'QUERY';
        } else if (lowerInput.includes('policy') || lowerInput.includes('rule')) {
            intent = 'POLICY';
        }

        // 2. Execution based on Intent
        switch (intent) {
            case 'NAVIGATION':
                return this.handleNavigation(lowerInput);
            case 'QUERY':
                return this.handleQuery(lowerInput);
            case 'POLICY':
                return this.handlePolicy(lowerInput);
            default:
                return { reply: "I'm here to help with HR tasks. Try asking about leaves or attendance." };
        }
    }

    async handleNavigation(input) {
        const map = {
            'people': 'people_core',
            'core': 'people_core',
            'employee': 'people_core',
            'org': 'people_core',
            'leave': 'leaves',
            'attendance': 'attendance',
            'pay': 'payroll',
            'payroll': 'payroll',
            'ewa': 'payroll',
            'recruit': 'recruitment',
            'talent': 'recruitment',
            'ats': 'recruitment',
            'onboard': 'onboarding',
            'perform': 'performance',
            'okr': 'performance',
            'analytic': 'analytics',
            'intelligence': 'analytics',
            'equity': 'analytics',
            'attrition': 'analytics',
            'learn': 'learning',
            'course': 'learning',
            'comp': 'compensation',
            'benefit': 'compensation',
            'mci': 'experience',
            'vedic': 'experience',
            'wellbeing': 'experience',
            'feed': 'experience',
            'kudos': 'experience',
            'integration': 'integrations',
            'api': 'integrations',
            'partner': 'integrations',
            'team': 'team',
            'project': 'projects',
            'setting': 'settings'
        };

        for (const [key, val] of Object.entries(map)) {
            if (input.includes(key)) {
                return {
                    reply: `Navigating you to ${val.replace('_', ' ').toUpperCase()} module.`,
                    action: { type: 'NAVIGATE', payload: val }
                };
            }
        }
        return { reply: "I couldn't figure out where you want to go. Try asking for People Core, Recruitment, Payroll, Analytics, or Vedic Wellbeing." };
    }

    async handleQuery(input) {
        if (input.includes('leave')) {
            const data = await tools.getLeaves(); // Mock email for now
            return {
                reply: `You have ${data.privilege} Privilege Leaves and ${data.casual} Casual Leaves remaining.`,
                action: { type: 'NAVIGATE', payload: 'leaves' } // Contextual nav
            };
        }
        if (input.includes('attendance')) {
            const data = await tools.getAttendance('mock@user.com');
            return { reply: `Status: ${data.status}. Punched in at ${data.punchIn}.` };
        }
        if (input.includes('salary')) {
            const data = await tools.getPayroll();
            return { reply: `Your last net pay was ${data.netPay}. processed on ${data.lastMonthPayout}.` };
        }
        return { reply: "I can look up leaves, attendance, and payroll for you." };
    }

    async handlePolicy(input) {
        const data = await tools.searchPolicy(input);
        if (Array.isArray(data)) {
            return { reply: `Policy found: ${data[0].content}` };
        }
        return { reply: data };
    }
}
