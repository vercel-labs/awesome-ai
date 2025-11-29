import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { startMockRegistry, stopMockRegistry } from "./lib/mock-registry"
import { createTestProject, runCLI } from "./lib/test-utils"

let mockRegistry: Awaited<ReturnType<typeof startMockRegistry>>

describe("view command", () => {
	let registryUrl: string

	beforeAll(async () => {
		mockRegistry = await startMockRegistry()
		registryUrl = mockRegistry.url
	})

	beforeEach(() => {
		mockRegistry.clearReceivedHeaders()
	})

	afterAll(async () => {
		await stopMockRegistry()
	})

	function createProjectWithRegistry() {
		return createTestProject({
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

		const result = await runCLI(["view", "test-tool"], { cwd: project.path })

		expect(result.exitCode).toBe(1)
		// CLI outputs errors to stdout via logger
		expect(result.stdout).toContain("--type")
	})

	it("shows tool details with --type tools", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-tool", "--type", "tools"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		expect(output.length).toBe(1)
		expect(output[0].name).toBe("test-tool")
		expect(output[0].type).toBe("registry:tool")
		expect(output[0].files).toBeDefined()
	})

	it("shows agent details with --type agents", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-agent", "--type", "agents"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		expect(output.length).toBe(1)
		expect(output[0].name).toBe("test-agent")
		expect(output[0].type).toBe("registry:agent")
	})

	it("shows prompt details with --type prompts", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-prompt", "--type", "prompts"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		expect(output.length).toBe(1)
		expect(output[0].name).toBe("test-prompt")
		expect(output[0].type).toBe("registry:prompt")
	})

	it("handles multiple items", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-tool", "@test/tool-with-lib", "--type", "tools"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(Array.isArray(output)).toBe(true)
		expect(output.length).toBe(2)
	})

	it("handles missing items with error", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/nonexistent-item", "--type", "tools"],
			{ cwd: project.path },
		)

		// Should fail since item doesn't exist
		expect(result.exitCode).toBe(1)
	})

	it("includes file content in response", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-tool", "--type", "tools"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(output[0].files).toBeDefined()
		expect(output[0].files.length).toBeGreaterThan(0)
		expect(output[0].files[0].content).toBeDefined()
	})

	it("includes dependencies in response", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-tool", "--type", "tools"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(output[0].dependencies).toBeDefined()
		expect(output[0].dependencies).toContain("zod")
	})

	it("includes registryDependencies for agents", async () => {
		const project = await createProjectWithRegistry()

		const result = await runCLI(
			["view", "@test/test-agent", "--type", "agents"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		const output = JSON.parse(result.stdout)
		expect(output[0].registryDependencies).toBeDefined()
		expect(output[0].registryDependencies).toContain("test-tool")
		expect(output[0].registryDependencies).toContain("test-prompt")
	})

	it("sends custom headers to registry", async () => {
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
					registries: {
						"@test": {
							url: `${registryUrl}/{type}/{name}.json`,
							headers: {
								Authorization: "Bearer test-token-123",
								"X-Custom-Header": "custom-value",
							},
						},
					},
				}),
			},
		})

		mockRegistry.clearReceivedHeaders()

		const result = await runCLI(
			["view", "@test/test-tool", "--type", "tools"],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)

		// Verify the mock server received the custom headers
		const headers = mockRegistry.getReceivedHeaders()
		expect(headers.length).toBeGreaterThan(0)

		// Find a request with our custom headers
		const requestWithHeaders = headers.find(
			(h) => h.authorization === "Bearer test-token-123",
		)
		expect(requestWithHeaders).toBeDefined()
		expect(requestWithHeaders?.["x-custom-header"]).toBe("custom-value")
	})
})
