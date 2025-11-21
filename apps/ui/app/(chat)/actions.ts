"use server"

import { agentDB } from "@/lib/agent"

export async function getChatHistory(endingBefore?: string, limit = 20) {
	const allChats = await agentDB.listChats()

	let chats = allChats

	if (endingBefore) {
		const endingIndex = allChats.findIndex((chat) => chat.id === endingBefore)
		if (endingIndex !== -1) {
			chats = allChats.slice(endingIndex + 1)
		}
	}

	const limitedChats = chats.slice(0, limit)

	return {
		chats: limitedChats.map((chat) => ({
			id: chat.id,
			title: "New Chat",
			updatedAt: new Date(chat.updatedAt),
		})),
		hasMore: chats.length > limit,
	}
}

export async function deleteChat({ id }: { id: string }) {
	await agentDB.deleteChat(id)
}

export async function deleteAllChats() {
	const chats = await agentDB.listChats()
	for (const chat of chats) {
		await agentDB.deleteChat(chat.id)
	}
}

export async function deleteTrailingMessages({ id }: { id: string }) {
	const chats = await agentDB.listChats()

	for (const chat of chats) {
		const messages = await agentDB.getMessages(chat.id)
		const messageIndex = messages.findIndex((m) => m.id === id)

		if (messageIndex !== -1) {
			const messagesToDelete = messages.slice(messageIndex + 1)

			for (const msg of messagesToDelete) {
				await agentDB.deleteMessage(msg.id)
			}

			return
		}
	}
}
