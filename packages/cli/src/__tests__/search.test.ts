import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { startMockRegistry, stopMockRegistry } from "./lib/mock-registry"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("search command", () => {
	let registryUrl: string
	let project: Awaited<ReturnType<typeof createTestProject>>

	beforeAll(async () => {
		const registry = await startMockRegistry()
		registryUrl = registry.url

		// All search tests share a single project (search is read-only)
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

	afterAll(async () => {
		await stopMockRegistry()
	})

	it("searches agents by name", async () => {
		const result = await runCLI(
			["search", "--query", "test", "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		// Should find items with "test" in name
		for (const item of output) {
			const matchesName = item.name.toLowerCase().includes("test")
			const matchesDescription = item.description
				?.toLowerCase()
				.includes("test")
			expect(matchesName || matchesDescription).toBe(true)
		}
	})

	it("searches by description", async () => {
		const result = await runCLI(
			["search", "--query", "cli testing", "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
	})

	it("returns empty array for no matches", async () => {
		const result = await runCLI(
			["search", "--query", "nonexistentthing12345", "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		expect(output.length).toBe(0)
	})

	it("filters by type with --type tools", async () => {
		const result = await runCLI(
			["search", "--query", "test", "--type", "tools", "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		// All results should be tools
		for (const item of output) {
			expect(item.type).toBe("registry:tool")
		}
	})

	it("filters by type with --type prompts", async () => {
		const result = await runCLI(
			["search", "--query", "test", "--type", "prompts", "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		// All results should be prompts
		for (const item of output) {
			expect(item.type).toBe("registry:prompt")
		}
	})

	it("returns all items without query", async () => {
		const result = await runCLI(["search", "--registry", "@test"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		expect(output.length).toBeGreaterThan(0)
	})

	it("search is case-insensitive", async () => {
		const resultLower = await runCLI(
			["search", "--query", "test", "--registry", "@test"],
			{ cwd: project.path },
		)
		const resultUpper = await runCLI(
			["search", "--query", "TEST", "--registry", "@test"],
			{ cwd: project.path },
		)

		expect(resultLower.exitCode).toBe(0)
		expect(resultUpper.exitCode).toBe(0)

		const outputLower = JSON.parse(resultLower.stdout)
		const outputUpper = JSON.parse(resultUpper.stdout)

		expect(outputLower.length).toBe(outputUpper.length)
	})
})
