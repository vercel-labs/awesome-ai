import { describe, expect, it } from "vitest"
import { createTestProject, runCLI } from "./lib/test-utils"

describe("test setup", () => {
	it("can create a test project", async () => {
		const project = await createTestProject()

		expect(project.path).toBeTruthy()
		expect(await project.exists(".")).toBe(true)
	})

	it("can create a test project with package.json", async () => {
		const project = await createTestProject({
			packageJson: { name: "test-project", version: "1.0.0" },
		})

		expect(await project.exists("package.json")).toBe(true)
		const content = await project.readFile("package.json")
		expect(content).toContain('"name": "test-project"')
	})

	it("can create a test project with tsconfig", async () => {
		const project = await createTestProject({
			tsconfig: true,
		})

		expect(await project.exists("tsconfig.json")).toBe(true)
		const content = await project.readFile("tsconfig.json")
		expect(content).toContain('"baseUrl"')
	})

	it("can create a test project with custom files", async () => {
		const project = await createTestProject({
			files: {
				"src/index.ts": "export const foo = 1",
				"src/utils/helper.ts": "export const bar = 2",
			},
		})

		expect(await project.exists("src/index.ts")).toBe(true)
		expect(await project.exists("src/utils/helper.ts")).toBe(true)
		expect(await project.readFile("src/index.ts")).toBe("export const foo = 1")
	})

	it("can run the CLI and get version", async () => {
		const project = await createTestProject()
		const result = await runCLI(["--version"], { cwd: project.path })

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
	})

	it("can run the CLI help command", async () => {
		const project = await createTestProject()
		const result = await runCLI(["--help"], { cwd: project.path })

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("add agents, tools, and prompts")
	})
})
