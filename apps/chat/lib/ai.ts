import { gateway } from "@ai-sdk/gateway"
import type { Agent } from "@/lib/agents"

const DEFAULT_MODEL = process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "openai/gpt-4o-mini"

export function getChatModel(modelId?: string) {
	return gateway(modelId ?? DEFAULT_MODEL)
}

export function buildSystemPrompt(agent: Agent | null) {
	const agentName = agent?.title ?? "Assistant"
	const categories = agent?.categories.length ? agent.categories.join(", ") : "general assistance"
	const description = agent?.description?.trim() || "No extra instructions provided."

	return `You are ${agentName}, an AI assistant in awesome-ai chat.

Specialization: ${categories}
Description: ${description}

Guidelines:
- Be concise, clear, and actionable.
- Prefer concrete examples when helpful.
- If you are unsure, say so and offer next steps.`
}
