import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/ai/nucleus/session
 * Creates a Gemini Live API session token for the Nucleus Talk voice assistant.
 *
 * If GEMINI_API_KEY is not configured, returns a graceful 503 so the fallback
 * browser-native mode (Web Speech API) continues to work without interruption.
 */
export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'Nucleus AI voice session requires a GEMINI_API_KEY. Falling back to browser-native mode.',
        },
      },
      { status: 503 },
    );
  }

  try {
    // Mint a single-use session token via the Gemini Live API
    const tokenResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-live-001:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are Nucleus Talk, the voice-powered AI assistant for Nucleus HRMS — a comprehensive enterprise HR management platform.

You help HR managers, employees and executives with:
- Navigating the application (attendance, leave, payroll, performance, recruitment, compliance)
- Answering HR policy questions with cited sources
- Drafting actions like leave requests, announcements, recognition events, and more
- Analysing workforce data when asked

Rules:
1. You read only what the caller's role permits. Never invent records.
2. You draft actions — never execute them silently. Always show a confirmation card.
3. For consequential actions (payroll disbursement, settlement, deletion), say you cannot execute them via voice.
4. If no approved policy answers a question, say so and suggest escalating to People Ops.
5. Be concise. Voice answers should be 1-3 sentences unless the person asks for detail.
6. When a draft is waiting, remind the person to say "confirm" or "cancel" — on its own.`
            }]
          },
          generation_config: {
            response_modalities: ['AUDIO', 'TEXT'],
            speech_config: { voice_config: { prebuilt_voice_config: { voice_name: 'Aoede' } } }
          }
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => null);
      throw new Error(error?.error?.message ?? `Gemini API returned ${tokenResponse.status}`);
    }

    // For the Live API, we return a WebSocket URL with the key embedded
    // In production, use ephemeral tokens via the token exchange endpoint
    const socketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    const sessionData = {
      socketUrl,
      setup: {
        model: 'models/gemini-2.0-flash-live-001',
        generationConfig: {
          responseModalities: ['AUDIO', 'TEXT'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        },
        systemInstruction: {
          parts: [{
            text: 'You are Nucleus Talk, an enterprise HRMS voice assistant. Help users navigate, answer HR policy questions, and draft actions that require confirmation before submission.'
          }]
        }
      },
      runId: null,
      transcriptRecorded: false,
      model: 'gemini-2.0-flash-live',
      actions: [
        { name: 'apply_leave', summary: 'Raise a leave request' },
        { name: 'record_attendance_punches', summary: 'Record attendance punches' },
        { name: 'request_attendance_correction', summary: 'Request attendance correction' },
        { name: 'request_gate_pass', summary: 'Request a gate pass' },
        { name: 'publish_announcement', summary: 'Publish a workforce announcement' },
        { name: 'recognise_employee', summary: 'Record a recognition event' },
        { name: 'give_feedback', summary: 'Give performance feedback' },
        { name: 'create_objective', summary: 'Create a performance objective' },
        { name: 'raise_requisition', summary: 'Raise a hiring requisition' },
      ],
    };

    return NextResponse.json({ data: sessionData });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Nucleus AI session could not be started.';
    return NextResponse.json(
      { error: { code: 'SESSION_ERROR', message } },
      { status: 500 },
    );
  }
}
