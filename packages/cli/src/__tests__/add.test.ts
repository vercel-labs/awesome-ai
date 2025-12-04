import path from "path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startMockRegistry, stopMockRegistry } from "./lib/mock-registry"
import { createTestProject, runCLI } from "./lib/test-utils"

const FIXTURES_DIR = path.resolve(__dirname, "fixtures")

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

	// Group tests that can share the same project setup
	describe("with standard registry project", () => {
		let project: Awaited<ReturnType<typeof createProjectWithRegistry>>

		beforeAll(async () => {
			project = await createProjectWithRegistry()
		})

		it("defaults to agent type when no flag is provided", async () => {
			const result = await runCLI(["add", "@test/simple-agent", "--yes"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(0)
			expect(await project.exists("agents/simple-agent.ts")).toBe(true)
		})

		it("adds tool files to correct location", async () => {
			const result = await runCLI(
				["add", "@test/test-tool", "--tool", "--yes"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			expect(await project.exists("tools/test-tool.ts")).toBe(true)

			const content = await project.readFile("tools/test-tool.ts")
			expect(content).toContain("testTool")
		})

		it("adds prompt files to correct location", async () => {
			const result = await runCLI(
				["add", "@test/test-prompt", "--prompt", "--yes"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			expect(await project.exists("prompts/test-prompt.ts")).toBe(true)
		})

		it("adds multiple items at once in a single command", async () => {
			const result = await runCLI(
				["add", "@test/test-tool", "@test/tool-with-lib", "--tool", "--yes"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			expect(await project.exists("tools/test-tool.ts")).toBe(true)
			expect(await project.exists("tools/tool-with-lib.ts")).toBe(true)
		})

		it("transforms @/tools imports to configured alias and adds lib files", async () => {
			const result = await runCLI(
				["add", "@test/tool-with-lib", "--tool", "--yes"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)

			// Main tool file created
			expect(await project.exists("tools/tool-with-lib.ts")).toBe(true)
			// Lib file created alongside
			expect(await project.exists("tools/lib/helper.ts")).toBe(true)

			const content = await project.readFile("tools/tool-with-lib.ts")
			// Import should be transformed to use configured alias
			expect(content).toContain("@/tools/lib/helper")
		})

		it("respects --silent flag", async () => {
			const result = await runCLI(
				["add", "@test/test-prompt", "--prompt", "--yes", "--silent"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			// Output should be minimal in silent mode
			expect(result.stdout.length).toBeLessThan(100)
		})

		it("adds agent with lib files to correct locations", async () => {
			const result = await runCLI(["add", "@test/agent-with-lib", "--yes"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(0)

			// Main agent file should be created
			expect(await project.exists("agents/agent-with-lib.ts")).toBe(true)

			// Agent lib files should be created in agents/lib/
			expect(await project.exists("agents/lib/context.ts")).toBe(true)
			expect(await project.exists("agents/lib/permissions.ts")).toBe(true)

			// Verify content of lib files
			const contextContent = await project.readFile("agents/lib/context.ts")
			expect(contextContent).toContain("createContext")

			const permissionsContent = await project.readFile(
				"agents/lib/permissions.ts",
			)
			expect(permissionsContent).toContain("Permission")
		})

		it("handles agent and prompt with same name correctly", async () => {
			const result = await runCLI(["add", "@test/full-agent", "--yes"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(0)

			// Both agent and prompt should be created with correct content
			expect(await project.exists("agents/full-agent.ts")).toBe(true)
			expect(await project.exists("prompts/full-agent.ts")).toBe(true)

			// Agent file should have agent-specific content
			const agentContent = await project.readFile("agents/full-agent.ts")
			expect(agentContent).toContain("fullAgent")
			expect(agentContent).toContain("prompt")

			// Prompt file should have prompt-specific content
			const promptContent = await project.readFile("prompts/full-agent.ts")
			expect(promptContent).toContain("prompt")
			expect(promptContent).toContain("full agent assistant")
		})

		it("resolves registry dependencies recursively", async () => {
			const result = await runCLI(["add", "@test/test-agent", "--yes"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(0)

			// Agent should be created
			expect(await project.exists("agents/test-agent.ts")).toBe(true)

			// Dependencies should also be created
			expect(await project.exists("tools/test-tool.ts")).toBe(true)
			expect(await project.exists("prompts/test-prompt.ts")).toBe(true)
		})
	})

	// Test that requires modifying files - needs separate project
	it("handles --overwrite flag for existing files", async () => {
		const project = await createProjectWithRegistry()

		// First add
		await runCLI(["add", "@test/test-tool", "--tool", "--yes"], {
			cwd: project.path,
		})

		// Modify the file
		await project.writeFile("tools/test-tool.ts", "// modified content")

		// Second add with overwrite
		const result = await runCLI(
			["add", "@test/test-tool", "--tool", "--yes", "--overwrite"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)

		const content = await project.readFile("tools/test-tool.ts")
		expect(content).not.toBe("// modified content")
		expect(content).toContain("testTool")
	})

	it("auto-confirms update with --yes flag when file exists", async () => {
		const project = await createProjectWithRegistry()

		// First add
		await runCLI(["add", "@test/test-tool", "--tool", "--yes"], {
			cwd: project.path,
		})

		// Modify the file
		await project.writeFile("tools/test-tool.ts", "// modified content")

		// Second add with just --yes (should auto-confirm the update prompt)
		const result = await runCLI(["add", "@test/test-tool", "--tool", "--yes"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)

		// File should be updated (auto-confirmed by --yes)
		const content = await project.readFile("tools/test-tool.ts")
		expect(content).not.toBe("// modified content")
		expect(content).toContain("testTool")
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

		const result = await runCLI(["add", "--tool"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("specify at least one item")
	})

	// Tests with custom ~/* alias - share a project
	describe("with custom ~/* aliases", () => {
		let project: Awaited<ReturnType<typeof createTestProject>>

		beforeAll(async () => {
			project = await createTestProject({
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
		})

		it("respects custom aliases in config for tools", async () => {
			const result = await runCLI(
				["add", "@test/tool-with-lib", "--tool", "--yes"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)

			// File should be in src/tools due to tsconfig path alias resolution
			// Import should use ~/tools alias
			const content = await project.readFile("src/tools/tool-with-lib.ts")
			expect(content).toContain("~/tools/lib/helper")
		})

		it("respects custom aliases for agents with src directory", async () => {
			const result = await runCLI(["add", "@test/agent-with-lib", "--yes"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(0)

			// Files should be in src/agents due to tsconfig path alias resolution
			expect(await project.exists("src/agents/agent-with-lib.ts")).toBe(true)
			expect(await project.exists("src/agents/lib/context.ts")).toBe(true)
			expect(await project.exists("src/agents/lib/permissions.ts")).toBe(true)

			// Imports should use ~/agents alias
			const agentContent = await project.readFile(
				"src/agents/agent-with-lib.ts",
			)
			expect(agentContent).toContain("~/agents/lib/context")
			expect(agentContent).toContain("~/agents/lib/permissions")
		})
	})
})

describe("add command with missing agents.json", () => {
	it("mentions agents.json when config is missing", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: {
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"@/*": ["./*"],
					},
				},
			},
			// No agents.json file - simulates missing config
		})

		const result = await runCLI(["add", "test-tool", "--tool", "--yes"], {
			cwd: project.path,
		})

		// The output should mention agents.json when config is missing
		expect(result.stdout).toContain("agents.json")
	})
})

describe("add command with circular dependencies", () => {
	let registryUrl: string

	beforeAll(async () => {
		const registry = await startMockRegistry()
		registryUrl = registry.url
	})

	afterAll(async () => {
		await stopMockRegistry()
	})

	it("warns about circular dependencies but still succeeds", async () => {
		const project = await createTestProject({
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

		const result = await runCLI(["add", "@test/circular-agent-a", "--yes"], {
			cwd: project.path,
		})

		// Should succeed despite circular dependencies
		expect(result.exitCode).toBe(0)

		// Should show warning about circular dependencies
		expect(result.stdout + result.stderr).toContain("Circular")

		// Files should still be created
		expect(await project.exists("agents/circular-agent-a.ts")).toBe(true)
		expect(await project.exists("agents/circular-agent-b.ts")).toBe(true)
	})
})

describe("add command with environment variable override", () => {
	let project: Awaited<ReturnType<typeof createTestProject>>

	beforeAll(async () => {
		project = await createTestProject({
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
					// No custom registry - uses builtin @awesome-ai
				}),
			},
		})
	})

	it("uses AWESOME_AI_REGISTRY_URL environment variable", async () => {
		// Use env var to point to local fixtures instead of GitHub
		const result = await runCLI(["add", "simple-agent", "--yes"], {
			cwd: project.path,
			env: {
				AWESOME_AI_REGISTRY_URL: FIXTURES_DIR,
			},
		})

		expect(result.exitCode).toBe(0)
		expect(await project.exists("agents/simple-agent.ts")).toBe(true)

		const content = await project.readFile("agents/simple-agent.ts")
		expect(content).toContain("simpleAgent")
	})

	it("REGISTRY_URL also works as fallback", async () => {
		// Use REGISTRY_URL as fallback
		const result = await runCLI(["add", "test-tool", "--tool", "--yes"], {
			cwd: project.path,
			env: {
				REGISTRY_URL: FIXTURES_DIR,
			},
		})

		expect(result.exitCode).toBe(0)
		expect(await project.exists("tools/test-tool.ts")).toBe(true)
	})
})

describe("add command with local file registry", () => {
	let project: Awaited<ReturnType<typeof createTestProject>>

	beforeAll(async () => {
		project = await createTestProject({
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
						// Use local file path instead of HTTP URL
						"@local": `${FIXTURES_DIR}/{type}/{name}.json`,
					},
				}),
			},
		})
	})

	it("supports local file path as registry URL", async () => {
		const result = await runCLI(["add", "@local/simple-agent", "--yes"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)
		expect(await project.exists("agents/simple-agent.ts")).toBe(true)

		const content = await project.readFile("agents/simple-agent.ts")
		expect(content).toContain("simpleAgent")
	})

	it("resolves dependencies from local file registry", async () => {
		const result = await runCLI(["add", "@local/agent-with-lib", "--yes"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)

		// Agent and its lib files should be created
		expect(await project.exists("agents/agent-with-lib.ts")).toBe(true)
		expect(await project.exists("agents/lib/context.ts")).toBe(true)
		expect(await project.exists("agents/lib/permissions.ts")).toBe(true)
	})

	it("handles local file paths for tools", async () => {
		const result = await runCLI(
			["add", "@local/test-tool", "--tool", "--yes"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("tools/test-tool.ts")).toBe(true)
	})
})
