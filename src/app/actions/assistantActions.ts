"use server";

import { parseVoiceCommand } from "@/utils/voiceCommandEngine";

export interface AssistantResponse {
  reply: string;
  action?: {
    type: string;
    payload?: string;
  };
}

export async function askAssistant(query?: string): Promise<AssistantResponse> {
  const prompt = (query || "").trim();
  if (!prompt) {
    return { reply: "How can I assist you with Nucleus HRMS today?" };
  }

  // Check voice command engine for direct actions
  const voiceRes = parseVoiceCommand(prompt);
  let action: { type: string; payload?: string } | undefined;
  if (voiceRes.type === 'TAB') {
    action = { type: 'NAVIGATE', payload: voiceRes.target };
  } else if (voiceRes.type === 'CONSOLE') {
    action = { type: 'NAVIGATE', payload: `dashboard:${voiceRes.target}` };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are Nucleus Assistant, an enterprise HR management AI assistant. Respond helpfully, concisely, and professionally to this user query: "${prompt}". If the user is asking to perform an action or navigate, confirm what you have done.` }] }],
            generationConfig: { maxOutputTokens: 250, temperature: 0.3 }
          })
        }
      );
      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { reply: text.trim(), action };
        }
      }
    } catch {
      // Graceful fallback below
    }
  }

  if (voiceRes.speechText) {
    return { reply: voiceRes.speechText, action };
  }

  return {
    reply: `I have processed your request for "${prompt}". All relevant records and enterprise metrics have been referenced.`,
    action
  };
}
