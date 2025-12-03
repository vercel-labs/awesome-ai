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

	// Validation tests - share a simple project
	describe("validation", () => {
		let project: Awaited<ReturnType<typeof createTestProject>>

		beforeAll(async () => {
			project = await createTestProject({
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
		})

		it("requires item name", async () => {
			const result = await runCLI(["diff", "--type", "tools"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(1)
			expect(result.stdout).toContain("specify both item name and type")
		})

		it("requires --type option", async () => {
			const result = await runCLI(["diff", "test-tool"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(1)
			expect(result.stdout).toContain("specify both item name and type")
		})
	})

	// Tests that don't add items first - share a project
	describe("without local files", () => {
		let project: Awaited<ReturnType<typeof createTestProject>>

		beforeAll(async () => {
			project = await createProjectWithRegistry()
		})

		it("handles missing local files gracefully", async () => {
			const result = await runCLI(
				["diff", "@test/test-tool", "--type", "tools"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain("does not exist locally")
		})

		it("handles nonexistent registry item", async () => {
			const result = await runCLI(
				["diff", "@test/nonexistent-tool", "--type", "tools"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(1)
			expect(result.stdout).toContain("not found")
		})
	})

	// Tests that add items then diff - share a project
	describe("with added registry items", () => {
		let project: Awaited<ReturnType<typeof createTestProject>>
		let identicalDiffResult: Awaited<ReturnType<typeof runCLI>>

		beforeAll(async () => {
			project = await createProjectWithRegistry()

			// Add all items upfront
			await runCLI(["add", "@test/test-tool", "--tool", "--yes"], {
				cwd: project.path,
			})
			await runCLI(["add", "@test/test-prompt", "--prompt", "--yes"], {
				cwd: project.path,
			})
			await runCLI(["add", "@test/simple-agent", "--yes"], {
				cwd: project.path,
			})

			// Capture diff result before any modifications (for identical test)
			identicalDiffResult = await runCLI(
				["diff", "@test/test-tool", "--type", "tools"],
				{ cwd: project.path },
			)
		})

		it("shows no diff for identical files", () => {
			expect(identicalDiffResult.exitCode).toBe(0)
		})

		it("shows diff for modified tool files", async () => {
			const originalContent = await project.readFile("tools/test-tool.ts")
			await project.writeFile(
				"tools/test-tool.ts",
				`${originalContent}\n// Local modification\n`,
			)

			const result = await runCLI(
				["diff", "@test/test-tool", "--type", "tools"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain("Local modification")
		})

		it("shows diff for modified prompts", async () => {
			await project.writeFile(
				"prompts/test-prompt.ts",
				'export const testPrompt = "Modified prompt"',
			)

			const result = await runCLI(
				["diff", "@test/test-prompt", "--type", "prompts"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			expect(result.stdout.length).toBeGreaterThan(0)
		})

		it("shows diff for modified agents", async () => {
			const content = await project.readFile("agents/simple-agent.ts")
			await project.writeFile(
				"agents/simple-agent.ts",
				content.replace("simple-agent", "modified-agent"),
			)

			const result = await runCLI(
				["diff", "@test/simple-agent", "--type", "agents"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
		})
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
				"--tool",
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
