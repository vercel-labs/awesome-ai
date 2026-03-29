import { describe, expect, it } from "vitest"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("sync command", () => {
	it("generates local registry from source files", async () => {
		const project = await createTestProject({
			packageJson: {
				name: "test-project",
				dependencies: {
					zod: "^4.1.12",
				},
			},
			tsconfig: true,
			files: {
				"agents.json": JSON.stringify({
					$schema: "https://awesome-ai.com/schema.json",
					tsx: true,
					aliases: {
						agents: "@/agents",
						tools: "@/tools",
						prompts: "@/prompts",
					},
				}),
				"agents/coding-agent.ts": `/**
 * Coding assistant for tests.
 * @category coding
 * @config apiKey string - OpenAI API key
 * @config apiKey env OPENAI_API_KEY
 * @context cwd
 */
import { z } from "zod"
import { testPrompt } from "@/prompts/test-prompt"
import { echoTool } from "@/tools/echo"

export const codingAgent = {
	name: "coding-agent",
	prompt: testPrompt,
	tools: { echoTool },
	schema: z.object({}),
}
`,
				"tools/echo.ts": `/**
 * Echo tool for tests.
 * @category utility
 */
export const echoTool = {
	name: "echo",
}
`,
				"prompts/test-prompt.ts": `export const testPrompt = "You are a test prompt."`,
			},
		})

		const result = await runCLI(["sync"], { cwd: project.path })
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Synced")

		expect(await project.exists(".awesome-ai/registry/agents/coding-agent.json")).toBe(true)
		expect(await project.exists(".awesome-ai/registry/tools/echo.json")).toBe(true)
		expect(await project.exists(".awesome-ai/registry/prompts/test-prompt.json")).toBe(true)

		const agentItem = JSON.parse(
			await project.readFile(".awesome-ai/registry/agents/coding-agent.json"),
		)
		expect(agentItem.type).toBe("registry:agent")
		expect(agentItem.categories).toEqual(["coding"])
		expect(agentItem.context).toEqual(["cwd"])
		expect(agentItem.config).toEqual([
			{
				name: "apiKey",
				type: "string",
				required: true,
				description: "OpenAI API key",
				env: "OPENAI_API_KEY",
			},
		])
		expect(agentItem.registryDependencies).toEqual(
			expect.arrayContaining(["tools:echo", "prompts:test-prompt"]),
		)
		expect(agentItem.dependencies).toEqual(expect.arrayContaining(["zod"]))

		const agentsIndex = JSON.parse(
			await project.readFile(".awesome-ai/registry/agents/registry.json"),
		)
		expect(agentsIndex.items).toHaveLength(1)
		expect(agentsIndex.items[0].name).toBe("coding-agent")
		expect(agentsIndex.items[0].files).toBeUndefined()
	})

	it("fails when agents.json is missing", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

		const result = await runCLI(["sync"], { cwd: project.path })
		expect(result.exitCode).toBe(1)
		expect(result.stdout).toContain("No agents.json found")
	})

	it("returns successfully when no source files are found", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
			files: {
				"agents.json": JSON.stringify({
					$schema: "https://awesome-ai.com/schema.json",
					tsx: true,
					aliases: {
						agents: "@/agents",
						tools: "@/tools",
						prompts: "@/prompts",
					},
				}),
			},
		})

		const result = await runCLI(["sync"], { cwd: project.path })
		expect(result.exitCode).toBe(0)
		expect(await project.exists(".awesome-ai/registry/agents/registry.json")).toBe(false)
	})

	it("writes to a custom output directory with --output", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
			files: {
				"agents.json": JSON.stringify({
					tsx: true,
					aliases: {
						agents: "@/agents",
						tools: "@/tools",
						prompts: "@/prompts",
					},
				}),
				"agents/simple-agent.ts": `export const simpleAgent = { name: "simple-agent" }`,
			},
		})

		const result = await runCLI(["sync", "--output", "registry"], {
			cwd: project.path,
		})
		expect(result.exitCode).toBe(0)
		expect(await project.exists("registry/agents/simple-agent.json")).toBe(true)
		expect(await project.exists(".awesome-ai/registry/agents/simple-agent.json")).toBe(false)
	})

	it("uses registryDir from agents.json and preserves existing registry items", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
			files: {
				"agents.json": JSON.stringify({
					tsx: true,
					registryDir: "registry",
					aliases: {
						agents: "@/agents",
						tools: "@/tools",
						prompts: "@/prompts",
					},
				}),
				"agents/new-agent.ts": `export const newAgent = { name: "new-agent" }`,
				"registry/agents/existing-agent.json": JSON.stringify({
					name: "existing-agent",
					type: "registry:agent",
					title: "Existing Agent",
					description: "pre-existing item",
					files: [
						{
							path: "agents/existing-agent.ts",
							type: "registry:agent",
							content: "export const existingAgent = {}",
						},
					],
				}),
			},
		})

		const result = await runCLI(["sync"], { cwd: project.path })
		expect(result.exitCode).toBe(0)

		expect(await project.exists("registry/agents/new-agent.json")).toBe(true)
		expect(await project.exists("registry/agents/existing-agent.json")).toBe(true)

		const agentsIndex = JSON.parse(await project.readFile("registry/agents/registry.json"))
		const names = agentsIndex.items.map((item: { name: string }) => item.name)
		expect(names).toEqual(expect.arrayContaining(["existing-agent", "new-agent"]))
	})
})
