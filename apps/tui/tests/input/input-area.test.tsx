import { describe, expect, mock, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { InputArea } from "../../src/components/input-area"
import { getBufferText, renderTui } from "../helpers/render"

mock.module("../../src/utils/agent", () => ({
	useAgentActions: () => ({
		handleToolApproval: () => Promise.resolve(true),
		startNewChat: () => Promise.resolve({ id: "chat-1" }),
		stopGeneration: () => true,
		sendMessage: () => Promise.resolve(),
		resetConversation: () => {},
		syncConversationMessages: () => {},
		subscribeToAgentChanges: () => () => {},
		isAgentLoaded: () => true,
		loadAgent: () => Promise.resolve(true),
	}),
}))

describe("InputArea", () => {
	test("shows prompt icon when idle", async () => {
		const result = await renderTui(<InputArea />)
		const output = getBufferText(result)
		expect(output).toContain("❯")
	})

	test("shows stop icon when loading", async () => {
		const result = await renderTui(<InputArea />, {
			store: createAppStore({ isLoading: true }),
		})
		const output = getBufferText(result)
		expect(output).toContain("■")
	})
})
