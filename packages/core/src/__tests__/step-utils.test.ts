import type { ModelMessage } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { summarizeMessages } from "../context"
import { createContextSummarizer, estimateMessageTokens } from "../step-utils"

vi.mock("../context", () => ({
	summarizeMessages: vi.fn(),
}))

describe("step utils compaction", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("does not compact below proactive trigger threshold", async () => {
		const summarizeMock = vi.mocked(summarizeMessages)
		summarizeMock.mockResolvedValue(null)
		const summarizer = createContextSummarizer({} as any, {
			thresholdTokens: 100,
			proactiveBufferTokens: 20,
			keepRecent: 3,
			protectTokens: 20_000,
			minimumPruneTokens: 5_000,
		})
		const result = await summarizer({
			steps: [{ usage: { inputTokens: 79 } }],
			messages: [{ role: "user", content: "hello" }],
		})
		expect(result).toEqual({})
		expect(summarizeMock).not.toHaveBeenCalled()
	})

	it("compacts at proactive threshold boundary", async () => {
		const summarizeMock = vi.mocked(summarizeMessages)
		const compacted: ModelMessage[] = [
			{ role: "system", content: "sys" },
			{ role: "assistant", content: "summary" },
		]
		summarizeMock.mockResolvedValue(compacted)
		const summarizer = createContextSummarizer({} as any, {
			thresholdTokens: 100,
			proactiveBufferTokens: 20,
			keepRecent: 3,
			protectTokens: 20_000,
			minimumPruneTokens: 5_000,
		})
		const result = await summarizer({
			steps: [{ usage: { inputTokens: 80 } }],
			messages: [{ role: "user", content: "hello" }],
		})
		expect(result).toEqual({ messages: compacted })
		expect(summarizeMock).toHaveBeenCalledTimes(1)
	})

	it("uses deterministic token estimation when usage is unavailable", async () => {
		const summarizeMock = vi.mocked(summarizeMessages)
		summarizeMock.mockResolvedValue(null)
		const summarizer = createContextSummarizer({} as any, {
			thresholdTokens: 100,
			proactiveBufferTokens: 20,
			keepRecent: 3,
			protectTokens: 20_000,
			minimumPruneTokens: 5_000,
		})
		const messages: ModelMessage[] = [{ role: "user", content: "x".repeat(320) }]
		const estimated = estimateMessageTokens(messages)
		expect(estimated).toBe(80)
		await summarizer({
			steps: [],
			messages,
		})
		expect(summarizeMock).toHaveBeenCalledTimes(1)
	})
})
