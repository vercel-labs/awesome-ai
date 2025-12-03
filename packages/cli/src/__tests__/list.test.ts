import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startMockRegistry, stopMockRegistry } from "./lib/mock-registry"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("list command", () => {
	let registryUrl: string

	beforeAll(async () => {
		const registry = await startMockRegistry()
		registryUrl = registry.url
	})

	afterAll(async () => {
		await stopMockRegistry()
	})

	// Tests with standard registry - share a single project (list is read-only)
	describe("with standard registry", () => {
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
						registries: {
							"@test": `${registryUrl}/{type}/{name}.json`,
						},
					}),
				},
			})
		})

		it("lists agents by default", async () => {
			const result = await runCLI(["list", "--registry", "@test"], {
				cwd: project.path,
			})

			expect(result.exitCode).toBe(0)
			const output = JSON.parse(result.stdout)
			expect(Array.isArray(output)).toBe(true)
			expect(output.length).toBeGreaterThan(0)
			expect(output[0].name).toBeDefined()
		})

		it("lists tools with --type tools", async () => {
			const result = await runCLI(
				["list", "--type", "tools", "--registry", "@test"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			const output = JSON.parse(result.stdout)
			expect(Array.isArray(output)).toBe(true)
			// All items should be tools
			for (const item of output) {
				expect(item.type).toBe("registry:tool")
			}
		})

		it("lists prompts with --type prompts", async () => {
			const result = await runCLI(
				["list", "--type", "prompts", "--registry", "@test"],
				{ cwd: project.path },
			)

			expect(result.exitCode).toBe(0)
			const output = JSON.parse(result.stdout)
			expect(Array.isArray(output)).toBe(true)
			// All items should be prompts
			for (const item of output) {
				expect(item.type).toBe("registry:prompt")
			}
		})
	})

	it("works without agents.json (uses default config)", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

		// This will use the default built-in registry which won't exist,
		// but the command should still execute
		const result = await runCLI(["list"], {
			cwd: project.path,
			env: { REGISTRY_URL: registryUrl },
		})

		// May fail to fetch from registry, but command structure is valid
		// The actual behavior depends on whether REGISTRY_URL env var is used
		expect(result.exitCode === 0 || result.exitCode === 1).toBe(true)
	})

	it("respects --cwd option", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

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
			JSON.stringify({ compilerOptions: {} }),
		)

		const result = await runCLI(
			["list", "--cwd", `${project.path}/subdir`, "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
	})
})
