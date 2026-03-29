import { describe, expect, mock, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { type ToolData, ToolPart } from "../../src/components/tool-part"
import { createAssistantMessage } from "../../src/types"
import { getBufferText, renderTui } from "../helpers/render"

mock.module("../../src/utils/agent", () => ({
	useAgentActions: () => ({
		handleToolApproval: () => Promise.resolve(true),
	}),
}))

describe("ToolPart", () => {
	test("shows approval request and actions", async () => {
		const store = createAppStore()
		const messageAtom = store.actions.addMessage(createAssistantMessage("hi"))

		const data: ToolData = {
			type: "tool-read",
			toolCallId: "tool-1",
			state: "approval-requested",
			approval: { id: "approval-1" },
		}

		const result = await renderTui(<ToolPart data={data} messageAtom={messageAtom} />, { store })

		const output = getBufferText(result)
		expect(output).toContain("Waiting for approval")
		expect(output).toContain("⌥ Y Approve")
		expect(output).toContain("⌥ N Deny")
	})
})
