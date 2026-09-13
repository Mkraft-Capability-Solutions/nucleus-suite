/**
 * Layer 3: Prompt Layer
 * Template instructions for the AI
 */

export const PROMPTS = {
    SYSTEM_MAIN: `You are Nucleus, an advanced HR AI Assistant. 
Your goal is to help employees with their daily HR tasks, answer queries about policies, and navigate them to the right tools.
Always be professional, concise, and helpful.`,

    INTENT_CLASSIFICATION: `Analyze the user's input and classify intent into one of:
- NAVIGATION: User wants to go to a specific page.
- QUERY: User is asking for data (leaves, attendance).
- POLICY: User is asking about rules.
- CHAT: General conversation.`,

    RESPONSE_TEMPLATES: {
        LEAVE_BALANCE: "You have {privilege} privilege leaves, {casual} casual leaves, and {sick} sick leaves remaining.",
        ATTENDANCE_STATUS: "You are currently marked as {status}. Punched in at {punchIn}.",
        NAVIGATE: "Sure, navigating you to the {target} section."
    }
};
