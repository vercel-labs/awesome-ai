import type { ModelMessage } from "ai"
import { generateText } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { pruneToolOutputs, summarizeMessages } from "@/agents/lib/context"

vi.mock("ai", async () => {
	const actual = await vi.importActual("ai")
	return {
		...actual,
		generateText: vi.fn(),
	}
})

describe("context management", () => {
	const mockedGenerateText = vi.mocked(generateText)

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("pruneToolOutputs", () => {
		it("returns original messages when nothing to prune", () => {
			const messages: ModelMessage[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there" },
			]

			const result = pruneToolOutputs(messages, {
				protectTokens: 40_000,
				minimumPruneTokens: 20_000,
			})

			expect(result.prunedCount).toBe(0)
			expect(result.messages).toEqual(messages)
		})

		it("does not prune when pruned size is below minimum threshold", () => {
			const largeOutput = "x".repeat(80_000) // ~20k tokens
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

			const result = pruneToolOutputs(messages, {
				protectTokens: 1_000,
				minimumPruneTokens: 30_000,
			})
			expect(result.prunedCount).toBe(0)
			expect(result.messages).toEqual(messages)
		})

		it("prunes old tool outputs when exceeding protect and minimum thresholds", () => {
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

			const result = pruneToolOutputs(messages, {
				protectTokens: 10_000,
				minimumPruneTokens: 20_000,
			})

			expect(result.prunedCount).toBe(1)
			expect(result.prunedTokens).toBeGreaterThan(20_000)
			// Check that the tool result was cleared
			const toolMsg = result.messages.find((m) => m.role === "tool")
			expect(toolMsg).toBeDefined()
			if (toolMsg && Array.isArray(toolMsg.content)) {
				const toolResult = toolMsg.content.find((p) => p.type === "tool-result") as
					| { output: { type: string; value: string } }
					| undefined
				expect(toolResult?.output.value).toBe("[Output cleared - see summary]")
			}
		})
	})

	describe("summarizeMessages", () => {
		it("returns null when no old messages can be summarized", async () => {
			const messages: ModelMessage[] = [
				{ role: "system", content: "sys" },
				{ role: "user", content: "hello" },
			]
			const result = await summarizeMessages(messages, {} as any, {
				thresholdTokens: 100,
				keepRecent: 8,
				protectTokens: 40_000,
				minimumPruneTokens: 20_000,
			})
			expect(result).toBeNull()
		})

		it("generates canonical compaction summary and keeps recent messages", async () => {
			mockedGenerateText.mockResolvedValue({
				text: "## Goal\nFinish task\n## Progress\nDone\n## Key Decisions\nA\n## Relevant Files\nx.ts\n## Next Actions\nRun tests",
			} as any)
			const messages: ModelMessage[] = [
				{ role: "system", content: "sys" },
				{ role: "user", content: "old-1" },
				{ role: "assistant", content: "old-2" },
				{ role: "user", content: "recent-1" },
				{ role: "assistant", content: "recent-2" },
			]
			const result = await summarizeMessages(messages, {} as any, {
				thresholdTokens: 100,
				keepRecent: 2,
				protectTokens: 40_000,
				minimumPruneTokens: 20_000,
			})
			expect(result).not.toBeNull()
			expect(result?.[0]?.role).toBe("system")
			expect(result?.[1]?.role).toBe("assistant")
			expect(typeof result?.[1]?.content).toBe("string")
			expect(result?.slice(-2).map((m) => m.content)).toEqual(["recent-1", "recent-2"])
		})

		it("uses fallback summary when hidden compaction flow fails", async () => {
			mockedGenerateText.mockRejectedValue(new Error("model down"))
			const messages: ModelMessage[] = [
				{ role: "system", content: "sys" },
				{ role: "user", content: "old-1" },
				{ role: "assistant", content: "old-2" },
				{ role: "user", content: "recent-1" },
				{ role: "assistant", content: "recent-2" },
			]
			const result = await summarizeMessages(messages, {} as any, {
				thresholdTokens: 100,
				keepRecent: 2,
				protectTokens: 40_000,
				minimumPruneTokens: 20_000,
			})
			expect(result).not.toBeNull()
			const fallback = result?.[1]
			expect(fallback?.role).toBe("assistant")
			expect(typeof fallback?.content).toBe("string")
			expect((fallback?.content as string).includes("## Goal")).toBe(true)
		})
	})
})
