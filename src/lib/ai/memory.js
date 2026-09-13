/**
 * Layer 5: Memory Layer
 * Management of conversation context and history
 */

export class MemoryManager {
    constructor() {
        // In a real serverless env, this would need a DB (Redis/Postgres).
        // For this implementation, we rely on the client passing history,
        // or we just handle the immediate turn.
        this.context = [];
    }

    async getContext(userId) {
        // Retrieve past N messages for this user
        return this.context;
    }

    async addInteraction(userId, userMsg, aiMsg) {
        // Store interaction
        this.context.push({ role: 'user', content: userMsg });
        this.context.push({ role: 'assistant', content: aiMsg });
    }
}

export const memory = new MemoryManager();
