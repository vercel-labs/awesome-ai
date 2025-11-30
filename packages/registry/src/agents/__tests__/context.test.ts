import type { ModelMessage } from "ai"
import { describe, expect, it } from "vitest"
import { pruneToolOutputs } from "@/agents/lib/context"

describe("context management", () => {
	describe("pruneToolOutputs", () => {
		it("returns original messages when nothing to prune", () => {
			const messages: ModelMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			]

			const result = pruneToolOutputs(messages, 40_000)

			expect(result.prunedCount).toBe(0)
			expect(result.messages).toEqual(messages)
		})

		it("prunes old tool outputs when exceeding protect threshold", () => {
			// Create messages with large tool output
			const largeOutput = "x".repeat(200_000) // ~50K tokens
			const messages: ModelMessage[] = [
				{ role: "user", content: "Do something" },
				{
					role: "assistant",
					content: [
						{
							type: "tool-call",
							toolCallId: "call-1",
							toolName: "read",
							input: {},
						},
					],
				},
				{
					role: "tool",
					content: [
						{
							type: "tool-result",
							toolCallId: "call-1",
							toolName: "read",
							output: { type: "text", value: largeOutput },
						},
					],
				},
			]

			const result = pruneToolOutputs(messages, 10_000) // Small threshold

			expect(result.prunedCount).toBe(1)
			// Check that the tool result was cleared
			const toolMsg = result.messages.find((m) => m.role === "tool")
			expect(toolMsg).toBeDefined()
			if (toolMsg && Array.isArray(toolMsg.content)) {
				const toolResult = toolMsg.content.find(
					(p) => p.type === "tool-result",
				) as { output: { type: string; value: string } } | undefined
				expect(toolResult?.output.value).toBe("[Output cleared - see summary]")
			}
		})
	})
})
