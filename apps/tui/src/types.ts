import type { UIMessage, UIMessagePart } from "ai"

// Message metadata includes timestamp for display
export interface TUIMessageMetadata {
	timestamp: string
}

export type TUIMessage = UIMessage<TUIMessageMetadata>

export type TUIMessagePart = UIMessagePart<
	Record<string, never>,
	Record<string, never>
>

export interface Command {
	name: string
	description: string
	action: () => void
}

export function getTimestamp(): string {
	const now = new Date()
	return `[${now.toLocaleTimeString("en-US", { hour12: false })}]`
}

export function createUserMessage(text: string): TUIMessage {
	return {
		id: crypto.randomUUID(),
		role: "user",
		metadata: { timestamp: getTimestamp() },
		parts: [{ type: "text", text }],
	}
}

export function createAssistantMessage(
	text: string,
	reasoning?: string,
): TUIMessage {
	const parts: TUIMessagePart[] = []

	if (reasoning) {
		parts.push({ type: "reasoning", text: reasoning })
	}

	parts.push({ type: "text", text })

	return {
		id: crypto.randomUUID(),
		role: "assistant",
		metadata: { timestamp: getTimestamp() },
		parts,
	}
}

export function createSystemMessage(text: string): TUIMessage {
	return {
		id: crypto.randomUUID(),
		role: "system",
		metadata: { timestamp: getTimestamp() },
		parts: [{ type: "text", text }],
	}
}

/**
 * Extract text content from a message's parts
 */
export function getMessageText(message: TUIMessage): string {
	return message.parts
		.filter(
			(part): part is { type: "text"; text: string } => part.type === "text",
		)
		.map((part) => part.text)
		.join("\n")
}

/**
 * Extract reasoning content from a message's parts
 */
export function getMessageReasoning(message: TUIMessage): string | undefined {
	const reasoningPart = message.parts.find(
		(part): part is { type: "reasoning"; text: string } =>
			part.type === "reasoning",
	)
	return reasoningPart?.text
}
