import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Message } from "./storage/file-storage"
import type { AgentMessage } from "./types"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function sanitizeText(text: string) {
	return text.replace(/\0/g, "")
}

export function convertStoredMessagesToUIMessages(
	messages: Message[],
	chatId: string,
): AgentMessage[] {
	return messages.map(
		(message) =>
			({
				...message,
				metadata: { ...(message.metadata || {}), chatId },
			}) as AgentMessage,
	)
}

export function getTextFromMessage(message: AgentMessage): string {
	return (
		message.parts
			?.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("") || ""
	)
}
