import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getEnvironmentContext } from "@/agents/lib/environment"

describe("getEnvironmentContext", () => {
	it("returns basic environment info with defaults", async () => {
		const ctx = await getEnvironmentContext()

		expect(ctx.workingDirectory).toBe(process.cwd())
		expect(ctx.platform).toBe(process.platform)
		expect(typeof ctx.date).toBe("string")
		expect(typeof ctx.isGitRepo).toBe("boolean")
	})

	it("uses custom cwd when provided", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-test-"))

		try {
			const ctx = await getEnvironmentContext({ cwd: tempDir })

			expect(ctx.workingDirectory).toBe(tempDir)
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true })
		}
	})

	it("excludes file tree when includeFileTree is false", async () => {
		const ctx = await getEnvironmentContext({ includeFileTree: false })

		expect(ctx.fileTree).toBeUndefined()
	})

	it("includes file tree by default", async () => {
		const ctx = await getEnvironmentContext()

		expect(ctx.fileTree).toBeDefined()
		expect(typeof ctx.fileTree).toBe("string")
	})

	it("excludes custom rules when includeCustomRules is false", async () => {
		const ctx = await getEnvironmentContext({ includeCustomRules: false })

		expect(ctx.customRules).toBeUndefined()
	})

	it("includes custom rules by default", async () => {
		const ctx = await getEnvironmentContext()

		expect(ctx.customRules).toBeDefined()
		expect(Array.isArray(ctx.customRules)).toBe(true)
	})

	describe("with temp directory", () => {
		let tempDir: string

		beforeEach(async () => {
			tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-test-"))
		})

		afterEach(async () => {
			await fs.rm(tempDir, { recursive: true, force: true })
		})

		it("detects non-git directory", async () => {
			const ctx = await getEnvironmentContext({ cwd: tempDir })

			expect(ctx.isGitRepo).toBe(false)
		})

		it("respects fileTreeLimit option", async () => {
			// Create more files than the limit
			for (let i = 0; i < 10; i++) {
				await fs.writeFile(path.join(tempDir, `file${i}.txt`), "content")
			}

			const ctx = await getEnvironmentContext({
				cwd: tempDir,
				fileTreeLimit: 3,
			})

			expect(ctx.fileTree).toBeDefined()
			const files = ctx.fileTree!.split("\n").filter(Boolean)
			expect(files.length).toBeLessThanOrEqual(3)
		})

		it("loads custom rules from AGENTS.md", async () => {
			const rulesContent = "# Custom Rules\n\nBe helpful."
			await fs.writeFile(path.join(tempDir, "AGENTS.md"), rulesContent)

			const ctx = await getEnvironmentContext({ cwd: tempDir })

			expect(ctx.customRules).toBeDefined()
			expect(ctx.customRules!.length).toBeGreaterThan(0)
			expect(ctx.customRules![0]).toContain("Be helpful")
		})

		it("loads custom rules from specified files", async () => {
			const rulesContent = "# Project Rules"
			await fs.writeFile(path.join(tempDir, "CUSTOM.md"), rulesContent)

			const ctx = await getEnvironmentContext({
				cwd: tempDir,
				customRuleFiles: ["CUSTOM.md"],
			})

			expect(ctx.customRules).toBeDefined()
			expect(ctx.customRules!.some((r) => r.includes("Project Rules"))).toBe(
				true,
			)
		})

		it("walks directory for file tree in non-git repos", async () => {
			await fs.mkdir(path.join(tempDir, "src"))
			await fs.writeFile(path.join(tempDir, "src", "index.ts"), "")
			await fs.writeFile(path.join(tempDir, "README.md"), "")

			const ctx = await getEnvironmentContext({ cwd: tempDir })

			expect(ctx.fileTree).toBeDefined()
			expect(ctx.fileTree).toContain("README.md")
		})

		it("ignores node_modules and other common directories", async () => {
			await fs.mkdir(path.join(tempDir, "node_modules"))
			await fs.writeFile(
				path.join(tempDir, "node_modules", "package.json"),
				"{}",
			)
			await fs.writeFile(path.join(tempDir, "index.ts"), "")

			const ctx = await getEnvironmentContext({ cwd: tempDir })

			expect(ctx.fileTree).toBeDefined()
			expect(ctx.fileTree).not.toContain("node_modules")
			expect(ctx.fileTree).toContain("index.ts")
		})
	})
})
