import {
	generateText,
	type LanguageModel,
	type ModelMessage,
	type ToolResultPart,
} from "ai"

export interface SummarizeConfig {
	thresholdTokens: number
	keepRecent: number
	protectTokens: number
	minimumPruneTokens: number
	summaryModel?: LanguageModel
}

const CLEARED_PLACEHOLDER = "[Output cleared - see summary]"

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

export function pruneToolOutputs(
	messages: ModelMessage[],
	config: { protectTokens: number; minimumPruneTokens: number },
): { messages: ModelMessage[]; prunedCount: number; prunedTokens: number } {
	const { protectTokens, minimumPruneTokens } = config
	let protectedTokens = 0
	let prunedCount = 0
	let prunedTokens = 0
	const toPrune: Set<string> = new Set()

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]!
		if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue

		for (let j = msg.content.length - 1; j >= 0; j--) {
			const part = msg.content[j]
			if (part?.type !== "tool-call") continue

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
				const resultMsgIdx = messages.indexOf(resultMsg)
				const resultPartIdx = resultMsg.content.findIndex(
					(p) => p.type === "tool-result" && p.toolCallId === part.toolCallId,
				)
				toPrune.add(`${resultMsgIdx}:${resultPartIdx}`)
				prunedCount++
				prunedTokens += tokens
			}
		}
	}

	if (toPrune.size === 0) {
		return { messages, prunedCount: 0, prunedTokens: 0 }
	}

	if (prunedTokens < minimumPruneTokens) {
		return { messages, prunedCount: 0, prunedTokens: 0 }
	}

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

	return { messages: pruned, prunedCount, prunedTokens }
}

const HIDDEN_COMPACTION_PROMPT = `You are the internal compaction agent for a coding runtime.
You are never user-facing.

Return markdown with exactly these sections in this order:
## Goal
## Progress
## Key Decisions
## Relevant Files
## Next Actions

Rules:
- Be concrete and preserve technical facts.
- Include concrete file paths when known.
- Keep each section concise and actionable.
- Do not include any extra sections.`

async function runHiddenCompactionFlow(
	messages: ModelMessage[],
	model: LanguageModel,
	prunedCount: number,
): Promise<ModelMessage> {
	const { text } = await generateText({
		model,
		system: HIDDEN_COMPACTION_PROMPT,
		messages: [
			...messages,
			{
				role: "user",
				content:
					`Compact the previous context for continued coding work. ` +
					`Tool output entries pruned: ${prunedCount}. ` +
					`Preserve intent, constraints, and pending work.`,
			},
		],
		maxOutputTokens: 2000,
	})

	return {
		role: "assistant",
		content: text.trim(),
	}
}

function createFallbackSummary(messageCount: number): ModelMessage {
	return {
		role: "assistant",
		content: `## Goal
Continue the active coding task with preserved constraints and intent.

## Progress
Previous conversation (${messageCount} messages) was compacted.

## Key Decisions
Historical detailed tool outputs may be pruned; rely on preserved recent context and this compact summary.

## Relevant Files
Use recent conversation context to identify active files before editing.

## Next Actions
Resume implementation from latest pending task and verify with targeted tests.`,
	}
}

export async function summarizeMessages(
	messages: ModelMessage[],
	model: LanguageModel,
	config: SummarizeConfig,
): Promise<ModelMessage[] | null> {
	const { keepRecent, protectTokens, minimumPruneTokens, summaryModel } = config
	const systemMsg = messages[0]!
	const recentCount = Math.min(keepRecent, Math.max(1, messages.length - 2))
	let splitIndex = messages.length - recentCount
	if (splitIndex < 1) splitIndex = 1
	while (splitIndex > 1 && messages[splitIndex]?.role === "tool") {
		splitIndex--
	}

	const oldMessages = messages.slice(1, splitIndex)
	const recentMessages = messages.slice(splitIndex)
	if (oldMessages.length === 0) return null

	const { messages: prunedOld, prunedCount } = pruneToolOutputs(oldMessages, {
		protectTokens,
		minimumPruneTokens,
	})

	let summaryMsg: ModelMessage
	try {
		summaryMsg = await runHiddenCompactionFlow(
			prunedOld,
			summaryModel ?? model,
			prunedCount,
		)
	} catch {
		summaryMsg = createFallbackSummary(oldMessages.length)
	}

	return [systemMsg, summaryMsg, ...recentMessages]
}
