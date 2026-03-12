import type { Tool } from "ai"
import { describe, expect, it } from "vitest"
import { createAgent } from "@/agents/coding-agent"

async function executeTool<T extends Tool>(
	tool: T,
	input: Parameters<NonNullable<T["execute"]>>[0],
) {
	const toolCallOptions = {
		toolCallId: "test-call-id",
		messages: [],
	}
	const result = tool.execute!(input, toolCallOptions)
	const results: unknown[] = []
	if (Symbol.asyncIterator in Object(result)) {
		for await (const r of result as AsyncIterable<unknown>) {
			results.push(r)
		}
	} else {
		results.push(await result)
	}
	return results
}

describe("coding agent runtime governance", () => {
	it("uses apply_patch instead of edit/write for gpt models", async () => {
		const agent = await createAgent({
			model: {} as any,
			modelId: "gpt-5",
			environment: {
				includeFileTree: false,
				includeCustomRules: false,
			},
		})
		expect(Object.keys(agent.tools)).toContain("apply_patch")
		expect(Object.keys(agent.tools)).not.toContain("edit")
		expect(Object.keys(agent.tools)).not.toContain("write")
	})

	it("uses edit/write for non-gpt models", async () => {
		const agent = await createAgent({
			model: {} as any,
			modelId: "claude-3-7-sonnet",
			environment: {
				includeFileTree: false,
				includeCustomRules: false,
			},
		})
		expect(Object.keys(agent.tools)).toContain("edit")
		expect(Object.keys(agent.tools)).toContain("write")
		expect(Object.keys(agent.tools)).not.toContain("apply_patch")
	})

	it("supports explicit tool mode override", async () => {
		const agent = await createAgent({
			model: {} as any,
			modelId: "claude-3-7-sonnet",
			toolMode: "patch",
			environment: {
				includeFileTree: false,
				includeCustomRules: false,
			},
		})
		expect(Object.keys(agent.tools)).toContain("apply_patch")
		expect(Object.keys(agent.tools)).not.toContain("edit")
		expect(Object.keys(agent.tools)).not.toContain("write")
	})

	it("applies explicit tool scopes for agent instances", async () => {
		const agent = await createAgent({
			model: {} as any,
			environment: {
				includeFileTree: false,
				includeCustomRules: false,
			},
			toolScope: { allow: ["read", "todoRead"] },
		})
		expect(Object.keys(agent.tools).sort()).toEqual(["read", "todoRead"])
	})

	it("uses constructor governance to block disallowed spawn types", async () => {
		const agent = await createAgent({
			model: {} as any,
			environment: {
				includeFileTree: false,
				includeCustomRules: false,
			},
			subagentGovernance: {
				taskPermissions: { "*": "allow" },
				allowedSubagentTypes: ["planning-agent"],
			},
		})
		const spawnTool = agent.tools.spawnAgent!
		expect(spawnTool).toBeDefined()
		const results = await executeTool(spawnTool, {
			type: "coding-agent",
			prompt: "blocked",
			fork_context: false,
		})
		const blocked = results.find(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"status" in entry &&
				entry.status === "error",
		) as { error?: string }
		expect(blocked.error).toContain("not allowed")
	})

	it("fails fast when toolScope includes unknown tools", async () => {
		await expect(
			createAgent({
				model: {} as any,
				environment: {
					includeFileTree: false,
					includeCustomRules: false,
				},
				toolScope: { allow: ["read", "not-a-real-tool" as any] },
			}),
		).rejects.toThrow("Unknown toolScope entries")
	})
})
