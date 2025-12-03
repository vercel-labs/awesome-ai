import type { UIMessage, UIMessagePart } from "ai"

// Message metadata includes timestamp for display
export interface TUIMessageMetadata {
	timestamp: number
	streaming?: true
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

export function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp)
	return `[${date.toLocaleTimeString("en-US", { hour12: false })}]`
}

export function createUserMessage(text: string): TUIMessage {
	return {
		id: crypto.randomUUID(),
		role: "user",
		metadata: { timestamp: Date.now() },
		parts: [{ type: "text", text }],
	}
}

export function createAssistantMessage(
	text: string = "",
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
		metadata: { timestamp: Date.now() },
		parts,
	}
}

export function createSystemMessage(text: string): TUIMessage {
	return {
		id: crypto.randomUUID(),
		role: "system",
		metadata: { timestamp: Date.now() },
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

/**
 * Standard tool output shape following our registry schema.
 * All tools output { status, message, ...additionalFields }
 */
export interface ToolOutputBase {
	status: "pending" | "streaming" | "success" | "error"
	message: string
}

/**
 * Extract the message from a tool output.
 * Works with any tool that follows our standard output schema.
 */
export function getToolMessage(output: unknown): string | undefined {
	if (
		output &&
		typeof output === "object" &&
		"message" in output &&
		typeof output.message === "string"
	) {
		return output.message
	}
	return undefined
}

/**
 * Extract the status from a tool output.
 */
export function getToolStatus(
	output: unknown,
): ToolOutputBase["status"] | undefined {
	if (
		output &&
		typeof output === "object" &&
		"status" in output &&
		typeof output.status === "string"
	) {
		const status = output.status
		if (
			status === "pending" ||
			status === "streaming" ||
			status === "success" ||
			status === "error"
		) {
			return status
		}
	}
	return undefined
}

/**
 * Extract the error message from a tool output.
 */
export function getToolError(output: unknown): string | undefined {
	if (
		output &&
		typeof output === "object" &&
		"error" in output &&
		typeof output.error === "string"
	) {
		return output.error
	}
	return undefined
}
