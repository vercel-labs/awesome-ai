import type { LanguageModel, ModelMessage } from "ai"
import { summarizeMessages } from "@/agents/lib/context"

const SUMMARIZE_THRESHOLD = 200_000
const SUMMARIZE_KEEP_RECENT = 8
const SUMMARIZE_PROTECT_TOKENS = 40_000

/**
 * Creates a `prepareStep` handler that automatically summarizes
 * older messages once the conversation exceeds the token threshold.
 */
export function createContextSummarizer(model: LanguageModel) {
	return async ({
		steps,
		messages,
	}: {
		steps: Array<{ usage?: { inputTokens?: number } }>
		messages: ModelMessage[]
	}) => {
		const lastStep = steps.at(-1)
		const inputTokens = lastStep?.usage?.inputTokens

		if (!inputTokens || inputTokens < SUMMARIZE_THRESHOLD) {
			return {}
		}

		const summarized = await summarizeMessages(messages, model, {
			threshold: SUMMARIZE_THRESHOLD,
			keepRecent: SUMMARIZE_KEEP_RECENT,
			protectTokens: SUMMARIZE_PROTECT_TOKENS,
		})

		return summarized ? { messages: summarized } : {}
	}
}

/**
 * Stops the agent loop when the last step produced text
 * without making any tool calls (i.e., the agent is done).
 */
export function stopOnTextResponse({
	steps,
}: {
	steps: Array<{ toolCalls?: Array<unknown> }>
}) {
	if (steps.length === 0) return false

	const lastStep = steps[steps.length - 1]
	if (!lastStep) return false

	if (lastStep.toolCalls && lastStep.toolCalls.length > 0) {
		return false
	}

	return true
}
