import type { LanguageModel, ModelMessage } from "ai"
import { summarizeMessages } from "@/agents/lib/context"

const SUMMARIZE_THRESHOLD = 180_000
const SUMMARIZE_KEEP_RECENT = 8
const SUMMARIZE_PROTECT_TOKENS = 40_000

/**
 * Rough token estimate: ~4 chars per token.
 * Used as a fallback when actual usage data isn't available (e.g. first step).
 */
function estimateMessageTokens(messages: ModelMessage[]): number {
	let chars = 0
	for (const msg of messages) {
		if (typeof msg.content === "string") {
			chars += msg.content.length
		} else if (Array.isArray(msg.content)) {
			for (const part of msg.content) {
				if ("text" in part && typeof part.text === "string") {
					chars += part.text.length
				} else if ("value" in part) {
					chars += JSON.stringify(part.value).length
				} else if ("input" in part) {
					chars += JSON.stringify(part.input).length
				}
				if ("output" in part) {
					chars += JSON.stringify(part.output).length
				}
			}
		}
	}
	return Math.ceil(chars / 4)
}

/**
 * Creates a `prepareStep` handler that automatically summarizes
 * older messages once the conversation exceeds the token threshold.
 *
 * Uses the previous step's actual inputTokens when available,
 * and falls back to a character-based estimate for the first step
 * (where no usage data exists yet).
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
		const inputTokens =
			lastStep?.usage?.inputTokens ?? estimateMessageTokens(messages)

		if (inputTokens < SUMMARIZE_THRESHOLD) {
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
