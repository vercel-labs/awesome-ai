import { describe, expect, mock, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import {
	PromptApproval,
	usePromptApprovalHandler,
} from "../../src/components/prompt-approval"
import { getBufferText, renderTui } from "../helpers/render"

const sendMessageSpy = mock(() => Promise.resolve())

mock.module("../../src/utils/agent", () => ({
	useAgentActions: () => ({
		sendMessage: sendMessageSpy,
		startNewChat: () => Promise.resolve({ id: "chat-1" }),
	}),
}))

describe("PromptApproval", () => {
	test("renders prompt header and content", async () => {
		const store = createAppStore({
			execPrompt: { name: "review", content: "Do the thing." },
			currentAgent: "alpha",
		})
		const result = await renderTui(
			<PromptApproval onApprove={() => {}} onDeny={() => {}} />,
			{ store },
		)
		const output = getBufferText(result)
		expect(output).toContain("Prompt:")
		expect(output).toContain("review")
		expect(output).toContain("Do the thing.")
	})

	test("approval handler switches to chat mode and sends prompt", async () => {
		const store = createAppStore({
			execPrompt: { name: "review", content: "Do the thing." },
			execMode: true,
		})

		let handler: (() => Promise<void>) | null = null
		const HandlerProbe = () => {
			handler = usePromptApprovalHandler()
			return null
		}

		await renderTui(<HandlerProbe />, { store })
		await handler?.()

		expect(store.atoms.execModeAtom.get()).toBe(false)
		expect(sendMessageSpy).toHaveBeenCalledWith("Do the thing.")
	})
})
