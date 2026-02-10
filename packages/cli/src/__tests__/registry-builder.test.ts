import { promises as fs } from "fs"
import { tmpdir } from "os"
import path from "path"
import { afterEach, describe, expect, it } from "vitest"
import {
	buildRegistryIndex,
	loadNpmPackages,
	processDirectory,
} from "../utils/registry-builder"

const tempDirs: string[] = []

async function createTempDir(prefix: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(tmpdir(), prefix))
	tempDirs.push(dir)
	return dir
}

afterEach(async () => {
	await Promise.all(
		tempDirs
			.splice(0)
			.map((dir) => fs.rm(dir, { recursive: true, force: true })),
	)
})

describe("registry-builder public API", () => {
	it("processDirectory extracts metadata and lib files for agents", async () => {
		const root = await createTempDir("registry-builder-")
		const srcDir = path.join(root, "src")
		const agentsDir = path.join(srcDir, "agents")

		await fs.mkdir(path.join(agentsDir, "lib"), { recursive: true })
		await fs.mkdir(path.join(srcDir, "tools", "lib"), { recursive: true })
		await fs.mkdir(path.join(srcDir, "tools"), { recursive: true })
		await fs.mkdir(path.join(srcDir, "prompts"), { recursive: true })

		await fs.writeFile(
			path.join(agentsDir, "coding-agent.ts"),
			`/**
 * Coding assistant for tests.
 * @category coding
 * @category typescript
 * @config apiKey string - OpenAI API key
 * @config apiKey env OPENAI_API_KEY
 * @context cwd
 */
import { z } from "zod"
import { formatInput } from "@/tools/lib/format-input"
import { echoTool } from "@/tools/echo"
import { testPrompt } from "@/prompts/test-prompt"
import { localHelper } from "./lib/local-helper"

export const codingAgent = {
	name: "coding-agent",
	tools: { echoTool },
	prompt: testPrompt,
	helper: localHelper,
	schema: z.object({ input: z.string() }),
	formatInput,
}
`,
			"utf-8",
		)
		await fs.writeFile(
			path.join(agentsDir, "lib", "local-helper.ts"),
			`export const localHelper = "local"`,
			"utf-8",
		)
		await fs.writeFile(
			path.join(srcDir, "tools", "lib", "format-input.ts"),
			`export const formatInput = (s: string) => s.trim()`,
			"utf-8",
		)

		const items = await processDirectory(
			"agents",
			agentsDir,
			srcDir,
			new Set(["zod"]),
		)
		expect(items).toHaveLength(1)

		const item = items[0]!
		expect(item.name).toBe("coding-agent")
		expect(item.type).toBe("registry:agent")
		expect(item.categories).toEqual(["coding", "typescript"])
		expect(item.context).toEqual(["cwd"])
		expect(item.config).toEqual([
			{
				name: "apiKey",
				type: "string",
				required: true,
				description: "OpenAI API key",
				env: "OPENAI_API_KEY",
			},
		])
		expect(item.dependencies).toEqual(["zod"])
		expect(item.registryDependencies).toEqual(
			expect.arrayContaining(["tools:echo", "prompts:test-prompt"]),
		)
		expect(item.files.map((f) => f.path)).toEqual(
			expect.arrayContaining([
				"agents/coding-agent.ts",
				"tools/lib/format-input.ts",
				"agents/lib/local-helper.ts",
			]),
		)
	})

	it("processDirectory skips lib and test files", async () => {
		const root = await createTempDir("registry-builder-")
		const srcDir = path.join(root, "src")
		const toolsDir = path.join(srcDir, "tools")

		await fs.mkdir(path.join(toolsDir, "lib"), { recursive: true })
		await fs.mkdir(path.join(toolsDir, "__tests__"), { recursive: true })

		await fs.writeFile(
			path.join(toolsDir, "real-tool.ts"),
			`export const real = {}`,
			"utf-8",
		)
		await fs.writeFile(
			path.join(toolsDir, "real-tool.test.ts"),
			`export {}`,
			"utf-8",
		)
		await fs.writeFile(
			path.join(toolsDir, "__tests__", "extra.ts"),
			`export {}`,
			"utf-8",
		)
		await fs.writeFile(
			path.join(toolsDir, "lib", "helper.ts"),
			`export {}`,
			"utf-8",
		)

		const items = await processDirectory(
			"tools",
			toolsDir,
			srcDir,
			new Set<string>(),
		)
		expect(items).toHaveLength(1)
		expect(items[0]?.name).toBe("real-tool")
	})

	it("buildRegistryIndex excludes files from index items", () => {
		const index = buildRegistryIndex(
			[
				{
					name: "coding-agent",
					type: "registry:agent",
					title: "Coding Agent",
					description: "Agent description",
					categories: ["coding"],
					files: [
						{
							path: "agents/coding-agent.ts",
							type: "registry:agent",
							content: "export const codingAgent = {}",
						},
					],
				},
			],
			"agents",
		)

		expect(index.name).toBe("@awesome-ai/agents")
		expect(index.homepage).toBe("https://awesome-ai.com")
		expect(index.items).toHaveLength(1)
		expect(index.items[0]?.name).toBe("coding-agent")
		expect((index.items[0] as { files?: unknown }).files).toBeUndefined()
	})

	it("loadNpmPackages reads dependency names from package.json", async () => {
		const root = await createTempDir("registry-builder-")
		await fs.writeFile(
			path.join(root, "package.json"),
			JSON.stringify({
				name: "test-project",
				dependencies: {
					zod: "^4.1.12",
					ai: "^6.0.50",
				},
			}),
			"utf-8",
		)

		const packages = await loadNpmPackages(root)
		expect([...packages].sort()).toEqual(["ai", "zod"])
	})

	it("loadNpmPackages returns an empty set when package.json is missing", async () => {
		const root = await createTempDir("registry-builder-")
		const packages = await loadNpmPackages(root)
		expect(packages.size).toBe(0)
	})
})
