import type { BaseChat, BaseChatMessage } from "./types"

/**
 * Abstract storage interface for persisting chats and messages.
 */
export abstract class AgentStorage<
	Chat extends BaseChat,
	Message extends BaseChatMessage,
> {
	abstract createChat(metadata?: Record<string, unknown>): Promise<Chat>
	abstract getChat(id: string): Promise<Chat | null>
	abstract updateChat(
		id: string,
		data: Partial<Omit<Chat, "id" | "created_at">>,
	): Promise<void>
	abstract deleteChat(id: string): Promise<void>
	abstract listChats(options?: {
		limit?: number
		offset?: number
	}): Promise<Chat[]>
	abstract saveMessage(chatId: string, message: Message): Promise<Message>
	abstract saveMessages(chatId: string, messages: Message[]): Promise<Message[]>
	abstract updateMessage(id: string, message: Message): Promise<Message>
	abstract getMessages(
		chatId: string,
		options?: {
			limit?: number
			offset?: number
		},
	): Promise<Message[]>
	abstract deleteMessage(id: string): Promise<void>
}
