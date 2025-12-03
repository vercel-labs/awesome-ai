import {
	generateText,
	type LanguageModel,
	type ModelMessage,
	type ToolResultPart,
} from "ai"

/**
 * Configuration for context summarization.
 */
export interface SummarizeConfig {
	/** Token threshold that triggered summarization */
	threshold: number
	/** Recent messages to preserve untouched */
	keepRecent: number
	/** Tool output tokens to protect from pruning */
	protectTokens: number
	/** Optional smaller model for summarization (cost savings) */
	summaryModel?: LanguageModel
}

const CLEARED_PLACEHOLDER = "[Output cleared - see summary]"

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

/**
 * Prune old tool outputs from messages while protecting recent ones.
 *
 * Walks backwards through messages, keeping the most recent tool outputs
 * (up to protectTokens worth) and clearing older ones.
 *
 * @param messages - Messages to prune (old messages only, not recent)
 * @param protectTokens - Token budget for tool outputs to keep
 */
export function pruneToolOutputs(
	messages: ModelMessage[],
	protectTokens: number,
): { messages: ModelMessage[]; prunedCount: number } {
	let protectedTokens = 0
	let prunedCount = 0

	// Track which tool results to prune (by message index and part index)
	const toPrune: Set<string> = new Set()

	// Walk backwards to find tool outputs
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]!
		if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue

		for (let j = msg.content.length - 1; j >= 0; j--) {
			const part = msg.content[j]
			if (part?.type !== "tool-call") continue

			// Find corresponding tool result
			const resultMsg = messages.find(
				(m, idx) =>
					idx > i &&
					m.role === "tool" &&
					m.content.some(
						(p) => p.type === "tool-result" && p.toolCallId === part.toolCallId,
					),
			)

			if (!resultMsg || !Array.isArray(resultMsg.content)) continue

			const resultPart = resultMsg.content.find(
				(p): p is ToolResultPart =>
					p.type === "tool-result" && p.toolCallId === part.toolCallId,
			)

			if (!resultPart) continue

			const tokens = estimateTokens(JSON.stringify(resultPart.output))
			if (protectedTokens + tokens <= protectTokens) {
				protectedTokens += tokens
			} else {
				// Mark for pruning
				const resultMsgIdx = messages.indexOf(resultMsg)
				const resultPartIdx = resultMsg.content.findIndex(
					(p) => p.type === "tool-result" && p.toolCallId === part.toolCallId,
				)
				toPrune.add(`${resultMsgIdx}:${resultPartIdx}`)
				prunedCount++
			}
		}
	}

	// If nothing to prune, return original
	if (toPrune.size === 0) {
		return { messages, prunedCount: 0 }
	}

	// Clone and prune
	const pruned: ModelMessage[] = messages.map((msg, msgIdx) => {
		if (msg.role !== "tool" || !Array.isArray(msg.content)) {
			return msg
		}

		const newContent = msg.content.map((part, partIdx) => {
			if (toPrune.has(`${msgIdx}:${partIdx}`) && part.type === "tool-result") {
				return {
					...part,
					output: { type: "text" as const, value: CLEARED_PLACEHOLDER },
				}
			}
			return part
		})

		return { ...msg, content: newContent }
	})

	return { messages: pruned, prunedCount }
}

const SUMMARIZATION_PROMPT = `You are a helpful AI assistant tasked with summarizing conversations.

When asked to summarize, provide a detailed but concise summary of the conversation.
Focus on information that would be helpful for continuing the conversation, including:
- What was done
- What is currently being worked on
- Which files are being modified
- What needs to be done next

Your summary should be comprehensive enough to provide context but concise enough to be quickly understood.`

/**
 * Generate a structured summary of old messages.
 */
async function generateSummary(
	messages: ModelMessage[],
	model: LanguageModel,
): Promise<ModelMessage> {
	const { text } = await generateText({
		model,
		system: SUMMARIZATION_PROMPT,
		messages: [
			...messages,
			{
				role: "user",
				content:
					"Provide a detailed but concise summary of our conversation above. " +
					"Focus on information that would be helpful for continuing the conversation, " +
					"including what we did, what we're doing, which files we're working on, and what we're going to do next.",
			},
		],
		maxOutputTokens: 2000,
	})

	return { role: "assistant", content: text }
}

/**
 * Create a fallback summary when LLM summarization fails.
 */
function createFallbackSummary(messageCount: number): ModelMessage {
	return {
		role: "assistant",
		content:
			`Previous conversation (${messageCount} messages) was summarized. ` +
			`Recent messages contain the current state. Continue from where we left off.`,
	}
}

/**
 * Summarize messages by pruning old tool outputs and generating a summary.
 * Returns null if summarization wasn't needed (not enough old messages).
 *
 * @param messages - All messages in the conversation
 * @param model - Language model to use for summarization
 * @param config - Summarization configuration
 */
export async function summarizeMessages(
	messages: ModelMessage[],
	model: LanguageModel,
	config: SummarizeConfig,
): Promise<ModelMessage[] | null> {
	const { keepRecent, protectTokens, summaryModel } = config

	// Split messages: system + old messages vs recent messages
	const systemMsg = messages[0]!
	const recentCount = Math.min(keepRecent, messages.length - 1)
	const oldMessages = messages.slice(1, -recentCount || undefined)
	const recentMessages = recentCount > 0 ? messages.slice(-recentCount) : []

	// If not enough old messages to summarize, skip
	if (oldMessages.length < 3) return null

	// Prune old tool outputs
	const { messages: prunedOld } = pruneToolOutputs(oldMessages, protectTokens)

	// Generate summary
	let summaryMsg: ModelMessage
	try {
		summaryMsg = await generateSummary(prunedOld, summaryModel ?? model)
	} catch (error) {
		console.warn("Summarization failed, using fallback:", error)
		summaryMsg = createFallbackSummary(oldMessages.length)
	}

	return [systemMsg, summaryMsg, ...recentMessages]
}
