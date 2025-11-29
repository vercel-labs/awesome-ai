import { describe, expect, it } from "vitest"
import {
	getConfig,
	getRawConfig,
	resolveConfigPaths,
} from "../utils/get-config"
import { createTestProject } from "./lib/test-utils"

describe("config loading", () => {
	describe("getRawConfig", () => {
		it("loads valid agents.json", async () => {
			const project = await createTestProject({
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

			const config = await getRawConfig(project.path)

			expect(config).not.toBeNull()
			expect(config?.tsx).toBe(true)
			expect(config?.aliases.agents).toBe("@/agents")
			expect(config?.aliases.tools).toBe("@/tools")
			expect(config?.aliases.prompts).toBe("@/prompts")
		})

		it("returns null when agents.json does not exist", async () => {
			const project = await createTestProject()

			const config = await getRawConfig(project.path)

			expect(config).toBeNull()
		})

		it("validates required aliases", async () => {
			const project = await createTestProject({
				files: {
					"agents.json": JSON.stringify({
						tsx: true,
						aliases: {
							agents: "@/agents",
							// Missing tools and prompts
						},
					}),
				},
			})

			await expect(getRawConfig(project.path)).rejects.toThrow()
		})

		it("handles custom registries in config", async () => {
			const project = await createTestProject({
				files: {
					"agents.json": JSON.stringify({
						tsx: true,
						aliases: {
							agents: "@/agents",
							tools: "@/tools",
							prompts: "@/prompts",
						},
						registries: {
							"@custom": "https://custom-registry.com/{type}/{name}.json",
						},
					}),
				},
			})

			const config = await getRawConfig(project.path)

			expect(config?.registries).toBeDefined()
			expect(config?.registries?.["@custom"]).toBe(
				"https://custom-registry.com/{type}/{name}.json",
			)
		})

		it("parses registry config with headers structure", async () => {
			const project = await createTestProject({
				files: {
					"agents.json": JSON.stringify({
						tsx: true,
						aliases: {
							agents: "@/agents",
							tools: "@/tools",
							prompts: "@/prompts",
						},
						registries: {
							"@private": {
								url: "https://private.com/{type}/{name}.json",
								headers: {
									Authorization: "Bearer ${TOKEN}",
								},
							},
						},
					}),
				},
			})

			const config = await getRawConfig(project.path)

			expect(config?.registries?.["@private"]).toBeDefined()
			// Verify the headers structure is preserved
			const registry = config?.registries?.["@private"]
			expect(typeof registry).toBe("object")
			if (typeof registry === "object" && registry !== null) {
				expect(registry.url).toBe("https://private.com/{type}/{name}.json")
				expect(registry.headers).toEqual({
					Authorization: "Bearer ${TOKEN}",
				})
			}
		})

		it("rejects invalid JSON", async () => {
			const project = await createTestProject({
				files: {
					"agents.json": "{ invalid json }",
				},
			})

			await expect(getRawConfig(project.path)).rejects.toThrow()
		})

		it("handles $schema field", async () => {
			const project = await createTestProject({
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

			const config = await getRawConfig(project.path)

			expect(config?.$schema).toBe("https://awesome-ai.com/schema.json")
		})
	})

	describe("getConfig", () => {
		it("loads and resolves config paths", async () => {
			const project = await createTestProject({
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
					}),
				},
			})

			const config = await getConfig(project.path)

			expect(config).not.toBeNull()
			expect(config?.resolvedPaths).toBeDefined()
			expect(config?.resolvedPaths.cwd).toBe(project.path)
		})

		it("returns null when no config exists", async () => {
			const project = await createTestProject({
				tsconfig: true,
			})

			const config = await getConfig(project.path)

			expect(config).toBeNull()
		})
	})

	describe("resolveConfigPaths", () => {
		it("resolves alias paths from tsconfig", async () => {
			const project = await createTestProject({
				tsconfig: {
					compilerOptions: {
						baseUrl: ".",
						paths: {
							"@/*": ["./src/*"],
						},
					},
				},
			})

			const rawConfig = {
				tsx: true,
				aliases: {
					agents: "@/agents",
					tools: "@/tools",
					prompts: "@/prompts",
				},
			}

			const config = await resolveConfigPaths(project.path, rawConfig)

			expect(config.resolvedPaths.cwd).toBe(project.path)
			// The paths should be resolved based on tsconfig
			expect(config.resolvedPaths.agents).toContain("agents")
			expect(config.resolvedPaths.tools).toContain("tools")
			expect(config.resolvedPaths.prompts).toContain("prompts")
		})

		it("adds built-in registries", async () => {
			const project = await createTestProject({
				tsconfig: true,
			})

			const rawConfig = {
				tsx: true,
				aliases: {
					agents: "@/agents",
					tools: "@/tools",
					prompts: "@/prompts",
				},
			}

			const config = await resolveConfigPaths(project.path, rawConfig)

			expect(config.registries).toBeDefined()
			expect(config.registries?.["@awesome-ai"]).toBeDefined()
		})
	})

	describe("tsx detection", () => {
		it("defaults tsx to true", async () => {
			const project = await createTestProject({
				files: {
					"agents.json": JSON.stringify({
						aliases: {
							agents: "@/agents",
							tools: "@/tools",
							prompts: "@/prompts",
						},
					}),
				},
			})

			const config = await getRawConfig(project.path)

			expect(config?.tsx).toBe(true)
		})

		it("respects explicit tsx: false", async () => {
			const project = await createTestProject({
				files: {
					"agents.json": JSON.stringify({
						tsx: false,
						aliases: {
							agents: "@/agents",
							tools: "@/tools",
							prompts: "@/prompts",
						},
					}),
				},
			})

			const config = await getRawConfig(project.path)

			expect(config?.tsx).toBe(false)
		})
	})
})
