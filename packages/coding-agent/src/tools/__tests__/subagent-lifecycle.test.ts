import { MemoryCacheStorage } from "@awesome-ai/core"
import type { LanguageModel, ModelMessage } from "ai"
import { describe, expect, it } from "vitest"
import {
	createSubagentLifecycleTools,
	type RuntimeAgent,
	SubagentRuntime,
} from "../subagent-lifecycle"
import { executeTool } from "./lib/test-utils"

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function createMockAgent(options?: { delayMs?: number }): RuntimeAgent {
	const delayMs = options?.delayMs ?? 0
	return {
		async stream({
			messages,
			abortSignal,
		}: {
			messages: ModelMessage[]
			abortSignal?: AbortSignal
		}) {
			if (abortSignal?.aborted) {
				throw new Error("aborted")
			}
			if (delayMs > 0) {
				await sleep(delayMs)
				if (abortSignal?.aborted) {
					throw new Error("aborted")
				}
			}
			const lastUser = messages
				.slice()
				.reverse()
				.find((msg) => msg.role === "user")
			const input =
				typeof lastUser?.content === "string" ? lastUser.content : "ok"
			return {
				response: Promise.resolve({
					messages: [
						{
							role: "assistant",
							content: `done:${input}`,
						},
					],
				}),
			}
		},
	}
}

function createRuntime(options?: {
	maxDepth?: number
	maxThreads?: number
	delayMs?: number
	cacheStorage?: MemoryCacheStorage
}) {
	const model = {} as LanguageModel
	return new SubagentRuntime({
		model,
		maxDepth: options?.maxDepth,
		maxThreads: options?.maxThreads,
		cacheStorage: options?.cacheStorage,
		resolveAgent: async () => createMockAgent({ delayMs: options?.delayMs }),
	})
}

describe("subagent lifecycle tools", () => {
	it("spawns and waits for completion", async () => {
		const runtime = createRuntime()
		const tools = createSubagentLifecycleTools({ runtime })
		const spawnResults = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "hello",
			fork_context: false,
		})
		const spawnSuccess = spawnResults.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		const waitResults = await executeTool(tools.waitForSubagents, {
			ids: [spawnSuccess.agent.id],
			timeout_ms: 2_000,
		})
		const waitSuccess = waitResults.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agents: Array<{ status: string }> }
		expect(waitSuccess.agents[0]?.status).toBe("completed")
	})

	it("enforces max thread limit", async () => {
		const runtime = createRuntime({ maxThreads: 1, delayMs: 200 })
		const tools = createSubagentLifecycleTools({ runtime })
		await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "first",
			fork_context: false,
		})
		const second = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "second",
			fork_context: false,
		})
		const hasError = second.some(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "error",
		)
		expect(hasError).toBe(true)
	})

	it("enforces task permission deny with deterministic output", async () => {
		const runtime = createRuntime()
		const tools = createSubagentLifecycleTools({
			runtime,
			taskPermissions: { "*": "allow", "coding-agent": "deny" },
		})
		const denied = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "blocked",
			fork_context: false,
		})
		const deniedResult = denied.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "error",
		) as { error?: string }
		expect(deniedResult.error).toContain("denied")
	})

	it("blocks disallowed subagent types by scope deterministically", async () => {
		const runtime = createRuntime()
		const tools = createSubagentLifecycleTools({
			runtime,
			allowedSubagentTypes: ["planning-agent"],
			taskPermissions: { "*": "allow" },
		})
		const denied = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "blocked-by-scope",
			fork_context: false,
		})
		const deniedResult = denied.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "error",
		) as { error?: string }
		expect(deniedResult.error).toContain("not allowed")
	})

	it("releases thread capacity after completion", async () => {
		const runtime = createRuntime({ maxThreads: 1 })
		const tools = createSubagentLifecycleTools({ runtime })
		const first = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "first",
			fork_context: false,
		})
		const firstSuccess = first.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		await executeTool(tools.waitForSubagents, {
			ids: [firstSuccess.agent.id],
			timeout_ms: 2_000,
		})
		const second = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "second",
			fork_context: false,
		})
		const hasSuccess = second.some(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		)
		expect(hasSuccess).toBe(true)
	})

	it("enforces max depth across nested spawns", async () => {
		const runtime = createRuntime({ maxDepth: 2 })
		const tools = createSubagentLifecycleTools({ runtime })
		const root = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "root",
			fork_context: false,
		})
		const rootSuccess = root.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		const child = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "child",
			parent_id: rootSuccess.agent.id,
			fork_context: false,
		})
		const childSuccess = child.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		const grandchild = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "grandchild",
			parent_id: childSuccess.agent.id,
			fork_context: false,
		})
		const hasError = grandchild.some(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "error",
		)
		expect(hasError).toBe(true)
	})

	it("close requires resume before send_input", async () => {
		const runtime = createRuntime()
		const tools = createSubagentLifecycleTools({ runtime })
		const spawn = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "initial",
			fork_context: false,
		})
		const spawnSuccess = spawn.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		await executeTool(tools.closeSubagent, { id: spawnSuccess.agent.id })
		const sendWhileClosed = await executeTool(tools.sendInput, {
			id: spawnSuccess.agent.id,
			prompt: "follow-up",
		})
		const sendError = sendWhileClosed.some(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "error",
		)
		expect(sendError).toBe(true)
		await executeTool(tools.resumeSubagent, { id: spawnSuccess.agent.id })
		const sendAfterResume = await executeTool(tools.sendInput, {
			id: spawnSuccess.agent.id,
			prompt: "follow-up",
		})
		const sendSuccess = sendAfterResume.some(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		)
		expect(sendSuccess).toBe(true)
	})

	it("wait returns timeout for still-running agents", async () => {
		const runtime = createRuntime({ delayMs: 1_000 })
		const tools = createSubagentLifecycleTools({ runtime })
		const spawn = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "slow",
			fork_context: false,
		})
		const spawnSuccess = spawn.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		const wait = await executeTool(tools.waitForSubagents, {
			ids: [spawnSuccess.agent.id],
			timeout_ms: 10,
		})
		const waitSuccess = wait.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { timedOut: boolean; agents: Array<{ status: string }> }
		expect(waitSuccess.timedOut).toBe(true)
		expect(waitSuccess.agents[0]?.status).toBe("timeout")
		await sleep(1_100)
		const waitAgain = await executeTool(tools.waitForSubagents, {
			ids: [spawnSuccess.agent.id],
			timeout_ms: 2_000,
		})
		const waitAgainSuccess = waitAgain.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { timedOut: boolean; agents: Array<{ status: string }> }
		expect(waitAgainSuccess.timedOut).toBe(false)
		expect(waitAgainSuccess.agents[0]?.status).toBe("completed")
	})

	it("interrupts running agent and allows follow-up input", async () => {
		const runtime = createRuntime({ delayMs: 500 })
		const tools = createSubagentLifecycleTools({ runtime })
		const spawn = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "slow",
			fork_context: false,
		})
		const spawnSuccess = spawn.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		const interrupt = await executeTool(tools.interruptSubagent, {
			id: spawnSuccess.agent.id,
		})
		const interruptSuccess = interrupt.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { status: string } }
		expect(interruptSuccess.agent.status).toBe("interrupted")
		const sendAfterInterrupt = await executeTool(tools.sendInput, {
			id: spawnSuccess.agent.id,
			prompt: "follow-up",
		})
		const sendSuccess = sendAfterInterrupt.some(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		)
		expect(sendSuccess).toBe(true)
	})

	it("tracks lifecycle metrics for caps, timeout, interrupt, and close", async () => {
		const runtime = createRuntime({ maxThreads: 1, delayMs: 300 })
		const tools = createSubagentLifecycleTools({ runtime })
		const first = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "slow-first",
			fork_context: false,
		})
		const firstSuccess = first.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string } }
		await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "should-hit-cap",
			fork_context: false,
		})
		await executeTool(tools.waitForSubagents, {
			ids: [firstSuccess.agent.id],
			timeout_ms: 10,
		})
		await executeTool(tools.interruptSubagent, { id: firstSuccess.agent.id })
		await executeTool(tools.closeSubagent, { id: firstSuccess.agent.id })
		const metrics = runtime.getMetrics()
		expect(metrics.threadCapHits).toBeGreaterThanOrEqual(1)
		expect(metrics.waitTimeouts).toBeGreaterThanOrEqual(1)
		expect(metrics.interrupts).toBeGreaterThanOrEqual(1)
		expect(metrics.closes).toBeGreaterThanOrEqual(1)
	})

	it("reports runtime lineage metadata in status", async () => {
		const runtime = createRuntime()
		const tools = createSubagentLifecycleTools({ runtime })
		const spawn = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "lineage",
			fork_context: false,
		})
		const spawnSuccess = spawn.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { runtimeId?: string; resumableScope?: string } }
		expect(spawnSuccess.agent.runtimeId).toBeTruthy()
		expect(spawnSuccess.agent.resumableScope).toBe("in_memory_runtime")
	})

	it("persists snapshots into injected cache storage", async () => {
		const cacheStorage = new MemoryCacheStorage()
		const runtime = createRuntime({ cacheStorage })
		const tools = createSubagentLifecycleTools({ runtime })
		const spawn = await executeTool(tools.spawnAgent, {
			type: "coding-agent",
			prompt: "cache",
			fork_context: false,
		})
		const spawnSuccess = spawn.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "success",
		) as { agent: { id: string; runtimeId?: string } }
		const runtimeId = spawnSuccess.agent.runtimeId
		expect(runtimeId).toBeTruthy()
		const keys = await cacheStorage.keys(`subagent:${runtimeId}:`)
		expect(keys.some((key) => key.includes(":status:"))).toBe(true)
		expect(keys.some((key) => key.includes(":lineage:"))).toBe(true)
		expect(keys.some((key) => key.endsWith(":metrics"))).toBe(true)
	})
})
