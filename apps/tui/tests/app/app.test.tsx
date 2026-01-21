import { describe, expect, mock, test } from "bun:test"
import { App } from "../../src/components/app"
import { createAppStore } from "../../src/components/atoms"
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

describe("App", () => {
	test("renders chat shell when not in exec mode", async () => {
		const store = createAppStore({
			currentAgent: "test-agent",
			selectedModel: "test-model",
		})
		const result = await renderTui(<App />, { store })

		const output = getBufferText(result)
		expect(output).toContain("v1.0.0")
		expect(output).toContain("test-agent")
		expect(output).toContain("shortcuts")
		expect(output).toContain("test-model")
		expect(output).toContain("session active")
	})

	test("renders prompt approval when in exec mode", async () => {
		const store = createAppStore({
			execMode: true,
			execPrompt: { name: "test-prompt", content: "Review this prompt." },
		})
		const result = await renderTui(<App />, { store })

		const output = getBufferText(result)
		expect(output).toContain("Prompt:")
		expect(output).toContain("test-prompt")
		expect(output).toContain("Review and approve")
	})
})
