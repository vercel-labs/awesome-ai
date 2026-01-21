import { describe, expect, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { MessageList } from "../../src/components/message-list"
import { createAssistantMessage, createUserMessage } from "../../src/types"
import { getBufferText, renderTui } from "../helpers/render"

describe("MessageList", () => {
	test("renders user and assistant messages", async () => {
		const store = createAppStore({
			messages: [createUserMessage("hello"), createAssistantMessage("world")],
		})
		const result = await renderTui(<MessageList />, { store, rows: 40 })
		const output = getBufferText(result)
		expect(output).toContain("world")
	})
})
