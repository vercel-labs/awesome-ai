import { describe, expect, mock, test } from "bun:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { useEffect } from "react"
import { createAppStore } from "../../src/components/atoms"
import { AgentControllerProvider, useAgentActions } from "../../src/utils/agent"
import { renderTui } from "../helpers/render"

mock.module("../../src/utils/storage", () => ({
	createChat: async () => ({
		id: "chat-1",
		title: "New Chat",
		messages: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}),
	saveChat: async () => {},
}))

mock.module("../../src/utils/settings", () => ({
	saveWorkspaceSettings: async () => {},
}))

describe("Input send message", () => {
	test("loads initial agent before sending message", async () => {
		const agentPath = fileURLToPath(new URL("../fixtures/mock-agent.ts", import.meta.url))
		const agentImportPath = pathToFileURL(agentPath).href

		const store = createAppStore({
			currentAgent: "mock-agent",
			availableAgents: [{ name: "mock-agent", path: agentImportPath }],
		})

		let resolveDone: (() => void) | null = null
		const done = new Promise<void>((resolve) => {
			resolveDone = resolve
		})

		const Harness = () => {
			const actions = useAgentActions()
			useEffect(() => {
				actions.sendMessage("hello").finally(() => resolveDone?.())
			}, [actions])
			return null
		}

		await renderTui(
			<AgentControllerProvider>
				<Harness />
			</AgentControllerProvider>,
			{ store },
		)
		await done

		const messages = store.atoms.messagesAtom.get().map((atom) => atom.get())
		const hasNoAgentMessage = messages.some(
			(msg) =>
				msg.role === "system" &&
				msg.parts.some((part) => part.type === "text" && part.text.includes("No agent loaded")),
		)

		expect(hasNoAgentMessage).toBe(false)
	})
})
