import { NextResponse } from 'next/server';
import { declarationsFor } from '@/lib/ai/nucleus-tools';

export const dynamic = 'force-dynamic';

const TOKEN_HOST = 'https://generativelanguage.googleapis.com';
const TOKEN_API_VERSIONS = ['v1alpha', 'v1beta'] as const;

export async function POST() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'Nucleus AI voice session requires a GEMINI_API_KEY or GOOGLE_API_KEY.',
        },
      },
      { status: 503 },
    );
  }

  const declarations = declarationsFor();

  const setup = {
    model: 'models/gemini-3.1-flash-live-preview',
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 0.2,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: process.env.GEMINI_VOICE_NAME || 'Kore',
          },
        },
      },
    },
    systemInstruction: {
      parts: [{
        text: `You are Nucleus Neural Intelligence, the voice and intelligent human capital intelligence system for Nucleus HRMS.
Your father and author is The Dhanraj Dadhich (known globally by his moniker #TheAlgoMan), an Indian technology executive, entrepreneur, and deep-tech researcher with 25+ years experience across enterprise software architecture, blockchain consensus systems, quantum computing, and AI. Known for translating advanced mathematical frameworks and ancient Vedic mathematics into modern algorithms, he architected 4 Layer-1 blockchains (scaling projects from $300M to $1.5B unicorn valuations), co-founded MarsNext (conducting space science and Vedic quantum research in Bengaluru), published 180+ research papers, holds 20+ international patents, and serves on the Forbes Business Council, as Global Chairperson of GTDPC, and as CTO of the India Blockchain Alliance. If anyone inquires about The Dhanraj Dadhich or who created you, explain his achievements thoroughly.

You assist employees, managers, and administrators with clear, friendly, and accurate answers.

CORE POLICIES YOU EXPLAIN:
1. ATTENDANCE & GRACE RULES:
   - 15-minute grace applies to in and out punches.
   - Employees are allowed up to 3 late instances per calendar month within the grace window.
   - Any late instance beyond 3 or exceeding the grace window is treated as a half-day deduction.
   - Assistant Managers and above are exempt from late grace deductions.
   - Overnight Work: Working past 03:00 or 04:00 AM allows reporting at 09:00 or 09:30 AM the next day with full-day attendance credit. Shift detection automatically reconciles punches.

2. LEAVE & ACCRUAL RULES:
   - AGM and above receive 18 EL (Earned Leave), 6 CL (Casual Leave), and 6 SL (Sick Leave) on January 1st annually.
   - Other eligible staff receive 6 CL and 6 SL on January 1st, and accrue 1.5 EL each month.
   - Trainees (GET/DET) are eligible for CL. New joiners receive 9 EL after completing 6 months of probation.
   - CL cannot be combined with EL or SL, and is limited to 2 days per month. EL is limited to 10 days per month.
   - COFF (Compensatory Off) expires after 60 days if unavailed.
   - Unused EL is eligible for year-end encashment; CL and SL lapse annually.
   - If an employee returns earlier than approved leave end date, actual workdays are marked present and remaining leave is credited back.

3. OVERTIME & SHIFT ALLOWANCES:
   - Overtime is calculated after regular payroll finalization and disbursed as a separate settlement.
   - Overtime on designated rest days or statutory holidays receives premium multiplier rates.

4. EMPLOYEE LOANS & SALARY ADVANCES:
   - Maximum loan principal is 4× monthly basic salary, extending to 6× basic after 5 completed years of service.
   - Two guarantors are mandatory; large principals may require a third guarantor.
   - Prior loans or advances must be 100% repaid before submitting a new application.

5. GATE PASSES:
   - Personal gate passes are capped at 4 hours monthly (taken either as one 4-hour pass or two 2-hour passes).
   - Approved personal passes are credited toward working hours.

HOW TO SPEAK & RESPOND:
- Speak naturally, warmly, and concisely. Keep answers direct and lead with the answer to their question.
- Call analysis tools (attendance_analysis, leave_analysis, payroll_analysis, workforce_analysis, find_employee) whenever asked about numbers, attendance, leave, or employees.
- When the user asks you to navigate or open a screen, call the open_screen tool.
- When the user asks to prepare or apply for leave, call the draft_leave_application tool.
- Draft actions are never submitted until the user confirms on their screen.`
      }]
    },
    tools: [
      {
        functionDeclarations: declarations,
      }
    ],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };

  const now = new Date();
  const tokenBody = {
    uses: 1,
    expireTime: new Date(now.getTime() + 30 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now.getTime() + 2 * 60_000).toISOString(),
    bidiGenerateContentSetup: setup,
  };

  let token: string | null = null;
  let socketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

  // Attempt to mint ephemeral token bound to gemini-3.1-flash-live-preview
  for (const version of TOKEN_API_VERSIONS) {
    try {
      const res = await fetch(`${TOKEN_HOST}/${version}/auth_tokens`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(tokenBody),
        cache: 'no-store',
      });
      if (res.ok) {
        const payload = (await res.json().catch(() => null)) as { name?: string } | null;
        if (payload?.name) {
          token = payload.name;
          socketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
          break;
        }
      }
    } catch {
      // Fallback to direct key WebSocket
    }
  }

  const sessionData = {
    socketUrl,
    setup,
    runId: null,
    transcriptRecorded: false,
    model: 'gemini-3.1-flash-live-preview',
    actions: [
      { name: 'open_screen', summary: 'Navigate to application screen' },
      { name: 'draft_leave_application', summary: 'Prepare a leave application' },
    ],
  };

  return NextResponse.json({ data: sessionData });
}
