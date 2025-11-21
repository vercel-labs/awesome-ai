import type { UIMessage } from "ai"

export interface BaseChat {
	id: string
}

export type BaseChatMessage = { chatId: string } & UIMessage
