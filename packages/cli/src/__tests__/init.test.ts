import { describe, expect, it } from "vitest"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("init command", () => {
	it("creates agents.json with default config using --defaults", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project", version: "1.0.0" },
			tsconfig: true,
		})

		const result = await runCLI(["init", "--yes", "--defaults"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)
		expect(await project.exists("agents.json")).toBe(true)

		const config = JSON.parse(await project.readFile("agents.json"))
		expect(config.tsx).toBe(true)
		expect(config.aliases).toBeDefined()
		expect(config.aliases.agents).toBe("@/agents")
		expect(config.aliases.tools).toBe("@/tools")
		expect(config.aliases.prompts).toBe("@/prompts")
	})

	it("outputs success message", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

		const result = await runCLI(["init", "--yes", "--defaults"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Success")
		expect(result.stdout).toContain("Project initialization completed")
	})

	it("overwrites existing config with --force", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
			files: {
				"agents.json": JSON.stringify({
					tsx: false,
					aliases: {
						agents: "~/old-agents",
						tools: "~/old-tools",
						prompts: "~/old-prompts",
					},
				}),
			},
		})

		// Verify old config exists
		const oldConfig = JSON.parse(await project.readFile("agents.json"))
		expect(oldConfig.aliases.agents).toBe("~/old-agents")

		// Run init with force
		const result = await runCLI(["init", "--yes", "--defaults", "--force"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)

		// Verify config was overwritten
		const newConfig = JSON.parse(await project.readFile("agents.json"))
		expect(newConfig.aliases.agents).toBe("@/agents")
	})

	it("respects --cwd option", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

		// Create a subdirectory
		await project.writeFile(
			"subdir/package.json",
			JSON.stringify({ name: "subproject" }),
		)
		await project.writeFile(
			"subdir/tsconfig.json",
			JSON.stringify({ compilerOptions: {} }),
		)

		const result = await runCLI(
			["init", "--yes", "--defaults", "--cwd", `${project.path}/subdir`],
			{ cwd: project.path },
		)

		expect(result.exitCode).toBe(0)
		expect(await project.exists("subdir/agents.json")).toBe(true)
		expect(await project.exists("agents.json")).toBe(false)
	})

	it("detects TypeScript project and sets tsx=true", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: {
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
				},
			},
		})

		const result = await runCLI(["init", "--yes", "--defaults"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)

		const config = JSON.parse(await project.readFile("agents.json"))
		expect(config.tsx).toBe(true)
	})

	it("works with --silent flag", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

		const result = await runCLI(["init", "--yes", "--defaults", "--silent"], {
			cwd: project.path,
		})

		expect(result.exitCode).toBe(0)
		expect(await project.exists("agents.json")).toBe(true)
		// Silent mode should have minimal output
		expect(result.stdout.length).toBeLessThan(100)
	})

	it("includes $schema in generated config", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project" },
			tsconfig: true,
		})

		await runCLI(["init", "--yes", "--defaults"], { cwd: project.path })

		const config = JSON.parse(await project.readFile("agents.json"))
		expect(config.$schema).toBeDefined()
	})
})
