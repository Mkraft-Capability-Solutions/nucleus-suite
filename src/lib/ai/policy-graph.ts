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
    return { answer: "I can explain the policy and prepare a review, but I cannot execute this consequential action without an authorised person confirming it in the relevant workflow." };
  }
  if (state.passages.length === 0) {
    return { answer: "I could not find an approved policy passage that answers this confidently. Please route this to People Ops instead of treating an uncited answer as policy." };
  }

  const evidence = state.passages.map((passage, index) => `[${index + 1}] ${passage.title} — ${passage.section}: ${passage.text}`).join("\n");
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { answer: `${state.passages[0].text} This is a policy-only answer; confirm the employee-specific facts in the relevant workflow before acting.` };
  }

  const model = new ChatOpenAI({ model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini", temperature: 0, maxRetries: Number(process.env.AI_MAX_RETRIES || 2), timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000) });
  const response = await model.invoke([
    { role: "system", content: "You are Mira, an HR policy assistant. Answer only from the supplied approved evidence. Be concise and humane. Do not infer protected or sensitive facts. Do not claim to execute actions. If the evidence is insufficient, say so. Refer to evidence with [1], [2] markers." },
    { role: "user", content: `Question: ${state.question}\n\nApproved evidence:\n${evidence}` },
  ]);
  const content = typeof response.content === "string" ? response.content : response.content.map((part) => "text" in part ? part.text : "").join("");
  return { answer: content || "The model returned no answer. Please try again." };
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
