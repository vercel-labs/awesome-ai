import { describe, expect, mock, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { ChatPicker, useChatPickerKeyHandler } from "../../src/components/chat-picker"
import { makeKeyEvent } from "../helpers/keys"
import { getBufferText, renderTui } from "../helpers/render"

let listChatsResult: Array<{ id: string; title: string; updatedAt: number }> = []

mock.module("../../src/utils/storage", () => ({
	listChats: () => Promise.resolve(listChatsResult),
	loadChat: () =>
		Promise.resolve({
			id: "chat-2",
			title: "Second",
			messages: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	deleteChat: () => Promise.resolve(),
}))

mock.module("../../src/utils/settings", () => ({
	saveWorkspaceSettings: () => Promise.resolve(),
}))

mock.module("../../src/utils/agent", () => ({
	useAgentActions: () => ({
		syncConversationMessages: () => {},
		startNewChat: () => Promise.resolve({ id: "chat-new" }),
	}),
}))

describe("ChatPicker", () => {
	test("shows empty state when no chats", async () => {
		listChatsResult = []
		const store = createAppStore({ chatList: [] })
		const result = await renderTui(<ChatPicker />, { store })
		const output = getBufferText(result)
		expect(output).toContain("No previous chats found")
	})

	test("renders chat list", async () => {
		listChatsResult = [
			{ id: "chat-1", title: "First", updatedAt: Date.now() },
			{ id: "chat-2", title: "Second", updatedAt: Date.now() },
		]
		const store = createAppStore({
			chatList: [
				{ id: "chat-1", title: "First", updatedAt: Date.now() },
				{ id: "chat-2", title: "Second", updatedAt: Date.now() },
			],
			currentChatId: "chat-1",
		})
		const result = await renderTui(<ChatPicker />, { store })
		const output = getBufferText(result)
		expect(output).toContain("First")
		expect(output).toContain("Second")
	})

	test("key handler navigates and selects chat", async () => {
		const store = createAppStore({
			showChatPicker: true,
			chatList: [
				{ id: "chat-1", title: "First", updatedAt: Date.now() },
				{ id: "chat-2", title: "Second", updatedAt: Date.now() },
			],
		})

		let handler: ((key: any) => boolean) | null = null
		const HandlerProbe = () => {
			handler = useChatPickerKeyHandler()
			return null
		}

		await renderTui(<HandlerProbe />, { store })

		handler?.(makeKeyEvent({ name: "down" }))
		expect(store.atoms.selectedChatIndexAtom.get()).toBe(1)

		handler?.(makeKeyEvent({ name: "return" }))
		expect(store.atoms.showChatPickerAtom.get()).toBe(false)
	})
})
