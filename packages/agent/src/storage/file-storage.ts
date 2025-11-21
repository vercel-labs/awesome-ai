import { promises as fs } from "node:fs"
import * as path from "node:path"
import type { UIMessage } from "ai"
import { AgentStorage } from "./agent-storage"
import type { BaseChat, BaseChatMessage } from "./types"
import { generateId } from "./utils"

export interface FileStorageOptions {
	baseDir?: string
}

export interface Chat extends BaseChat {
	updatedAt: number
}

export type Message = BaseChatMessage & {
	updatedAt: number
}

/**
 * File system implementation of AgentStorage
 * Stores chats and messages as JSON files on disk
 *
 * Structure:
 * {baseDir}/
 *   {chat-id}/
 *     chat.json      - Chat data
 *     messages.json  - Array of StoredMessage objects
 */
export class FileStorage extends AgentStorage<Chat, Message> {
	private baseDir: string

	constructor(options: FileStorageOptions = {}) {
		super()
		this.baseDir = options.baseDir || ".agent-storage"
	}

	async createChat(): Promise<Chat> {
		const chat: Chat = {
			id: generateId(),
			updatedAt: Date.now(),
		}

		const chatDir = this.getChatDir(chat.id)

		await fs.mkdir(chatDir, { recursive: true })
		await this.writeChatFile(chat)
		await this.writeMessagesFile(chat.id, [])

		return chat
	}

	async getChat(id: string): Promise<Chat | null> {
		try {
			const chatPath = this.getChatPath(id)
			const content = await fs.readFile(chatPath, "utf-8")

			return JSON.parse(content) as Chat
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return null
			}
			throw error
		}
	}

	async updateChat(
		id: string,
		data: Partial<Omit<Chat, "id" | "created_at">>,
	): Promise<void> {
		const chat = await this.getChat(id)
		if (!chat) throw new Error(`Chat ${id} not found`)

		const updatedChat: Chat = { ...chat, ...data, updatedAt: Date.now() }

		await this.writeChatFile(updatedChat)
	}

	async deleteChat(id: string): Promise<void> {
		const chatDir = this.getChatDir(id)

		try {
			await fs.rm(chatDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore if directory doesn't exist
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error
			}
		}
	}

	async listChats({
		limit,
		offset = 0,
	}: {
		limit?: number
		offset?: number
	} = {}): Promise<Chat[]> {
		try {
			await fs.access(this.baseDir)
		} catch {
			return []
		}

		const entries = await fs.readdir(this.baseDir, { withFileTypes: true })
		const chatDirs = entries.filter((entry) => entry.isDirectory())
		const chats: Chat[] = []

		for (const dir of chatDirs) {
			const chat = await this.getChat(dir.name)
			if (chat) {
				chats.push(chat)
			}
		}
		chats.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)

		const end = limit ? offset + limit : undefined

		return chats.slice(offset, end)
	}

	async saveMessage(chatId: string, message: UIMessage): Promise<Message> {
		// Ensure chat directory exists
		await this.ensureChatExists(chatId)

		const storedMessage: Message = {
			...message,
			id: generateId(),
			chatId,
			updatedAt: Date.now(),
		}
		const messages = await this.readMessagesFile(chatId)

		messages.push(storedMessage)
		await this.writeMessagesFile(chatId, messages)
		await this.updateChat(chatId, {})

		return storedMessage
	}

	async saveMessages(
		chatId: string,
		messages: UIMessage[],
	): Promise<Message[]> {
		// Ensure chat directory exists
		await this.ensureChatExists(chatId)

		const storedMessages: Message[] = messages.map((message) => ({
			...message,
			id: generateId(),
			chatId,
			updatedAt: Date.now(),
		}))
		const existingMessages = await this.readMessagesFile(chatId)

		existingMessages.push(...storedMessages)
		await this.writeMessagesFile(chatId, existingMessages)
		await this.updateChat(chatId, {})

		return storedMessages
	}

	async updateMessage(id: string, message: UIMessage): Promise<Message> {
		const chats = await this.listChats()

		for (const chat of chats) {
			const messages = await this.readMessagesFile(chat.id)
			const index = messages.findIndex((m) => m.id === id)

			if (index !== -1) {
				const existing = messages[index]
				if (!existing) throw new Error(`Message at index ${index} is undefined`)

				const updatedMessage: Message = {
					...existing,
					...message,
					updatedAt: Date.now(),
				}

				messages[index] = updatedMessage
				await this.writeMessagesFile(chat.id, messages)
				await this.updateChat(chat.id, {})

				return updatedMessage
			}
		}

		throw new Error(`Message ${id} not found`)
	}

	async getMessages(
		chatId: string,
		{
			limit,
			offset = 0,
		}: {
			limit?: number
			offset?: number
		} = {},
	): Promise<Message[]> {
		const storedMessages = await this.readMessagesFile(chatId)
		const end = limit ? offset + limit : undefined
		return storedMessages.slice(offset, end)
	}

	async deleteMessage(id: string): Promise<void> {
		const chats = await this.listChats()

		for (const chat of chats) {
			const messages = await this.readMessagesFile(chat.id)
			const filteredMessages = messages.filter((m) => m.id !== id)

			if (filteredMessages.length < messages.length) {
				await this.writeMessagesFile(chat.id, filteredMessages)
				await this.updateChat(chat.id, {})
				return
			}
		}

		throw new Error(`Message ${id} not found`)
	}

	private async ensureChatExists(chatId: string): Promise<void> {
		const chatDir = this.getChatDir(chatId)

		try {
			await fs.access(chatDir)
			// Directory exists, we're good
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				// Directory doesn't exist, create it with chat metadata
				const chat: Chat = {
					id: chatId,
					updatedAt: Date.now(),
				}

				await fs.mkdir(chatDir, { recursive: true })
				await this.writeChatFile(chat)
				await this.writeMessagesFile(chatId, [])
			} else {
				throw error
			}
		}
	}

	private getChatDir(chatId: string): string {
		return path.join(this.baseDir, chatId)
	}

	private getChatPath(chatId: string): string {
		return path.join(this.getChatDir(chatId), "chat.json")
	}

	private getMessagesPath(chatId: string): string {
		return path.join(this.getChatDir(chatId), "messages.json")
	}

	private async writeChatFile(chat: Chat): Promise<void> {
		const chatPath = this.getChatPath(chat.id)
		const tempPath = `${chatPath}.tmp`

		// Atomic write: write to temp file, then rename
		await fs.writeFile(tempPath, JSON.stringify(chat, null, 2), "utf-8")
		await fs.rename(tempPath, chatPath)
	}

	private async writeMessagesFile(
		chatId: string,
		messages: Message[],
	): Promise<void> {
		const messagesPath = this.getMessagesPath(chatId)
		const tempPath = `${messagesPath}.tmp`

		// Atomic write: write to temp file, then rename
		await fs.writeFile(tempPath, JSON.stringify(messages, null, 2), "utf-8")
		await fs.rename(tempPath, messagesPath)
	}

	private async readMessagesFile(chatId: string): Promise<Message[]> {
		try {
			const messagesPath = this.getMessagesPath(chatId)
			const content = await fs.readFile(messagesPath, "utf-8")

			return JSON.parse(content) as Message[]
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return []
			}
			throw error
		}
	}
}
