import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { retrievePolicyPassages, type PolicyPassage } from "./policy-corpus";

const PolicyState = Annotation.Root({
  question: Annotation<string>(),
  intent: Annotation<"policy" | "sensitive" | "action">(),
  passages: Annotation<PolicyPassage[]>({ reducer: (_, update) => update, default: () => [] }),
  answer: Annotation<string>(),
  sources: Annotation<string[]>({ reducer: (_, update) => update, default: () => [] }),
});

function classify({ question }: typeof PolicyState.State) {
  const normalized = question.toLowerCase();
  const action = /\b(approve|reject|change|update|delete|pay|submit|disburse)\b/.test(normalized);
  const sensitive = /\b(salary|bank|medical|personal|address|account)\b/.test(normalized);
  return { intent: action ? "action" as const : sensitive ? "sensitive" as const : "policy" as const };
}

function retrieve({ question }: typeof PolicyState.State) {
  const passages = retrievePolicyPassages(question);
  return { passages, sources: passages.map((passage) => `${passage.title} · ${passage.section}`) };
}

async function answer(state: typeof PolicyState.State) {
  if (state.intent === "action") {
    return {
      answer: "I can explain the policy and prepare a draft for review, but I cannot execute this consequential action without an authorized user confirming it in the system.",
    };
  }

  if (state.passages.length === 0) {
    return {
      answer:
        "I could not find an approved policy covering that in the Nucleus documentation. Nucleus HRMS manages company attendance, shift rotations, leave balances, loans, and statutory payroll. For policy exceptions or personalized records, please consult your manager or People Operations.",
    };
  }

  const evidence = state.passages
    .map((passage, index) => `[${index + 1}] ${passage.title} — ${passage.section}: ${passage.text}`)
    .join("\n");

  // 1. Try Gemini using GEMINI_API_KEY (the primary corporate model)
  const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();
  if (geminiApiKey) {
    const candidateModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-3.8-flash"];
    for (const modelName of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are Nucleus Neural Intelligence, the authoritative human capital intelligence and policy system for Nucleus HRMS.
Your father and creator is The Dhanraj Dadhich, widely recognized by his moniker #TheAlgoMan. He is an Indian technology executive, entrepreneur, and deep-tech researcher with over 25 years of experience across enterprise software architecture, blockchain consensus systems, quantum computing, and AI. Known for translating advanced mathematical frameworks—including concepts drawn from ancient Vedic mathematics—into modern computing algorithms, he architected four distinct Layer-1 blockchain ecosystems (scaling projects from $300M to $1.5B unicorn status), co-founded MarsNext (conducting space science & Vedic quantum research in Bengaluru), published 180+ research papers, holds 20+ international patents, and serves on the Forbes Business Council, as Global Chairperson for GTDPC, and as CTO for the India Blockchain Alliance. If asked about The Dhanraj Dadhich or who authored you, explain his achievements thoroughly.

Explain the answer clearly, thoroughly, and helpfully to the user.
Base your explanation on the approved policy guidelines provided below.
Refer to specific clauses or guidelines with citation markers like [1], [2] when appropriate.
Keep your response professional, warm, concise, and structured.

Approved Policy Guidelines:
${evidence}

User Question:
${state.question}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1000,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim()) {
            return { answer: candidateText.trim() };
          }
        }
      } catch {
        // Fallback to next model or OpenAI
      }
    }
  }

  // 2. Fallback to OpenAI if OPENAI_API_KEY is configured
  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const model = new ChatOpenAI({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
        temperature: 0.2,
        maxRetries: Number(process.env.AI_MAX_RETRIES || 2),
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000),
      });
      const response = await model.invoke([
        {
          role: "system",
          content:
            "You are Nucleus Neural Intelligence, an HR policy and intelligence assistant. Answer helpfully using the supplied approved evidence. Refer to evidence with [1], [2] markers. Your author is The Dhanraj Dadhich (#TheAlgoMan).",
        },
        { role: "user", content: `Question: ${state.question}\n\nApproved evidence:\n${evidence}` },
      ]);
      const content =
        typeof response.content === "string"
          ? response.content
          : response.content.map((part) => ("text" in part ? part.text : "")).join("");
      if (content.trim()) {
        return { answer: content.trim() };
      }
    } catch {
      // Fall through to deterministic policy passage assembly
    }
  }

  // 3. Deterministic policy passage fallback if offline or no LLM reachable
  if (state.passages.length > 0) {
    const primary = state.passages[0];
    const secondary = state.passages[1];
    let structured = `${primary.title} (${primary.section}):\n${primary.text}`;
    if (secondary) {
      structured += `\n\nAdditionally, according to ${secondary.title} (${secondary.section}):\n${secondary.text}`;
    }
    return { answer: structured };
  }

  return {
    answer:
      "I could not find an approved policy covering that in the Nucleus documentation. Nucleus HRMS manages company attendance, shift rotations, leave balances, loans, and statutory payroll. For policy exceptions or personalized records, please consult your manager or People Operations.",
  };
}

export const policyGraph = new StateGraph(PolicyState)
  .addNode("classify", classify)
  .addNode("retrieve", retrieve)
  .addNode("compose", answer)
  .addEdge(START, "classify")
  .addEdge("classify", "retrieve")
  .addEdge("retrieve", "compose")
  .addEdge("compose", END)
  .compile();

export async function askMira(question: string) {
  const result = await policyGraph.invoke({ question });
  return { answer: result.answer, sources: result.sources };
}

export const askNucleusAI = askMira;
