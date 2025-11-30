import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startMockRegistry, stopMockRegistry } from "./lib/mock-registry"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("diff command", () => {
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

	it("requires item name", async () => {
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

		const result = await runCLI(["diff", "--type", "tools"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("specify both item name and type")
	})

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

		const result = await runCLI(["diff", "test-tool"], { cwd: project.path })

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("specify both item name and type")
	})

	it("shows no diff for identical files", async () => {
		const project = await createProjectWithRegistry()

		// First add the tool
		await runCLI(["add", "@test/test-tool", "--type", "tools", "--yes"], {
			cwd: project.path,
		})

		// Then check diff
		const result = await runCLI(
			["diff", "@test/test-tool", "--type", "tools"],
			{
				cwd: project.path,
			},
		)

		expect(result.exitCode).toBe(0)
		// Should have minimal output since files are identical
	})

	it("shows diff for modified files", async () => {
		const project = await createProjectWithRegistry()

		// First add the tool
		await runCLI(["add", "@test/test-tool", "--type", "tools", "--yes"], {
			cwd: project.path,
		})

		// Modify the file
		const originalContent = await project.readFile("tools/test-tool.ts")
		await project.writeFile(
			"tools/test-tool.ts",
			`${originalContent}\n// Local modification\n`,
		)

		// Then check diff
		const result = await runCLI(
			["diff", "@test/test-tool", "--type", "tools"],
			{
				cwd: project.path,
			},
		)

		expect(result.exitCode).toBe(0)
		// Should show the difference
		expect(result.stdout).toContain("Local modification")
	})

	it("handles missing local files gracefully", async () => {
		const project = await createProjectWithRegistry()

		// Don't add the tool, just check diff
		const result = await runCLI(
			["diff", "@test/test-tool", "--type", "tools"],
			{
				cwd: project.path,
			},
		)

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("does not exist locally")
	})

	it("handles nonexistent registry item", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["diff", "@test/nonexistent-tool", "--type", "tools"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("not found")
	})

	it("shows diff for prompts", async () => {
		const project = await createProjectWithRegistry()

		// Add the prompt
		await runCLI(["add", "@test/test-prompt", "--type", "prompts", "--yes"], {
			cwd: project.path,
		})

		// Modify it
		await project.writeFile(
			"prompts/test-prompt.ts",
			'export const testPrompt = "Modified prompt"',
		)

		// Check diff
		const result = await runCLI(
			["diff", "@test/test-prompt", "--type", "prompts"],
			{
				cwd: project.path,
			},
		)

		expect(result.exitCode).toBe(0)
		// Should show a diff
		expect(result.stdout.length).toBeGreaterThan(0)
	})

	it("shows diff for agents", async () => {
		const project = await createProjectWithRegistry()

		// Add a simple agent (no dependencies)
		await runCLI(["add", "@test/simple-agent", "--type", "agents", "--yes"], {
			cwd: project.path,
		})

		// Modify it
		const content = await project.readFile("agents/simple-agent.ts")
		await project.writeFile(
			"agents/simple-agent.ts",
			content.replace("simple-agent", "modified-agent"),
		)

		// Check diff
		const result = await runCLI(
			["diff", "@test/simple-agent", "--type", "agents"],
			{
				cwd: project.path,
			},
		)

		expect(result.exitCode).toBe(0)
	})

	it("respects --cwd option", async () => {
		const project = await createProjectWithRegistry()

		// Create a subdirectory with its own config
		await project.writeFile(
			"subdir/agents.json",
			JSON.stringify({
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
		)
		await project.writeFile(
			"subdir/tsconfig.json",
			JSON.stringify({
				compilerOptions: {
					baseUrl: ".",
					paths: { "@/*": ["./*"] },
				},
			}),
		)

		// Add tool in subdir
		await runCLI(
			[
				"add",
				"@test/test-tool",
				"--type",
				"tools",
				"--yes",
				"--cwd",
				`${project.path}/subdir`,
			],
			{ cwd: project.path },
		)

		// Diff in subdir
		const result = await runCLI(
			[
				"diff",
				"@test/test-tool",
				"--type",
				"tools",
				"--cwd",
				`${project.path}/subdir`,
			],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
	})
})
