import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startMockRegistry, stopMockRegistry } from "./lib/mock-registry"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("add command", () => {
	let registryUrl: string

	beforeAll(async () => {
		const registry = await startMockRegistry()
		registryUrl = registry.url
	})

	afterAll(async () => {
		await stopMockRegistry()
	})

	function createProjectWithRegistry() {
		return createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: {
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"@/*": ["./*"],
					},
				},
			},
			files: {
				"agents.json": JSON.stringify({
					tsx: true,
					aliases: {
						agents: "@/agents",
						tools: "@/tools",
						prompts: "@/prompts",
					},
					registries: {
						"@test": `${registryUrl}/{type}/{name}.json`,
					},
				}),
			},
		})
	}

	it("requires --type option", async () => {
		// Simple test - doesn't need registry
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
			},
		})

		const result = await runCLI(["add", "test-tool"], { cwd: project.path })

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("--type")
	})

	it("requires item names", async () => {
		// Simple test - doesn't need registry
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
			},
		})

		const result = await runCLI(["add", "--type", "tools"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("specify at least one item")
	})

	it("adds tool files to correct location", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["add", "@test/test-tool", "--type", "tools", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("tools/test-tool.ts")).toBe(true)

		const content = await project.readFile("tools/test-tool.ts")
		expect(content).toContain("testTool")
	})

	it("adds prompt files to correct location", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["add", "@test/test-prompt", "--type", "prompts", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("prompts/test-prompt.ts")).toBe(true)
	})

	it("adds agent files to correct location", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["add", "@test/simple-agent", "--type", "agents", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("agents/simple-agent.ts")).toBe(true)
	})

	it("transforms @/tools imports to configured alias", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["add", "@test/tool-with-lib", "--type", "tools", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)

		const content = await project.readFile("tools/tool-with-lib.ts")
		// Import should be transformed to use configured alias
		expect(content).toContain("@/tools/lib/helper")
	})

	it("adds lib files alongside main tool file", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["add", "@test/tool-with-lib", "--type", "tools", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("tools/tool-with-lib.ts")).toBe(true)
		expect(await project.exists("tools/lib/helper.ts")).toBe(true)
	})

	it("handles --overwrite flag for existing files", async () => {
		const project = await createProjectWithRegistry()

		// First add
		await runCLI(["add", "@test/test-tool", "--type", "tools", "--yes"], {
			cwd: project.path,
		})

		// Modify the file
		await project.writeFile("tools/test-tool.ts", "// modified content")

		// Second add with overwrite
		const result = await runCLI(
			["add", "@test/test-tool", "--type", "tools", "--yes", "--overwrite"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)

		const content = await project.readFile("tools/test-tool.ts")
		expect(content).not.toBe("// modified content")
		expect(content).toContain("testTool")
	})

	it("respects --silent flag", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["add", "@test/test-tool", "--type", "tools", "--yes", "--silent"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		// Output should be minimal in silent mode
		expect(result.stdout.length).toBeLessThan(100)
	})

	it("adds multiple items at once", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			[
				"add",
				"@test/test-tool",
				"@test/tool-with-lib",
				"--type",
				"tools",
				"--yes",
			],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("tools/test-tool.ts")).toBe(true)
		expect(await project.exists("tools/tool-with-lib.ts")).toBe(true)
	})

	it("respects custom aliases in config", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: {
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"~/*": ["./src/*"],
					},
				},
			},
			files: {
				"agents.json": JSON.stringify({
					tsx: true,
					aliases: {
						agents: "~/agents",
						tools: "~/tools",
						prompts: "~/prompts",
					},
					registries: {
						"@test": `${registryUrl}/{type}/{name}.json`,
					},
				}),
			},
		})

		const result = await runCLI(
			["add", "@test/tool-with-lib", "--type", "tools", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)

		// File should be in src/tools due to tsconfig path alias resolution
		// Import should use ~/tools alias
		const content = await project.readFile("src/tools/tool-with-lib.ts")
		expect(content).toContain("~/tools/lib/helper")
	})
})
