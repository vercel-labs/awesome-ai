import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { grepTool } from "../grep"
import { executeTool } from "./lib/test-utils"

describe("grepTool", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "grep-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("finds pattern in files", async () => {
		await fs.writeFile(
			path.join(tempDir, "file.txt"),
			"hello world\nfoo bar\nhello again",
		)

		const results = await executeTool(grepTool, {
			pattern: "hello",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			matchCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(2)
		expect(finalResult?.result).toContain("hello world")
		expect(finalResult?.result).toContain("hello again")
	})

	it("returns line numbers", async () => {
		await fs.writeFile(
			path.join(tempDir, "file.txt"),
			"line 1\ntarget line\nline 3",
		)

		const results = await executeTool(grepTool, {
			pattern: "target",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain("Line 2")
	})

	it("searches multiple files", async () => {
		await fs.writeFile(path.join(tempDir, "a.txt"), "match in a")
		await fs.writeFile(path.join(tempDir, "b.txt"), "match in b")

		const results = await executeTool(grepTool, {
			pattern: "match",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			matchCount: number
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(2)
		expect(finalResult?.result).toContain("a.txt")
		expect(finalResult?.result).toContain("b.txt")
	})

	it("supports regex patterns", async () => {
		await fs.writeFile(
			path.join(tempDir, "file.txt"),
			"foo123bar\nfoo456bar\nno match",
		)

		const results = await executeTool(grepTool, {
			pattern: "foo\\d+bar",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			matchCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(2)
	})

	it("filters by include pattern", async () => {
		await fs.writeFile(path.join(tempDir, "code.ts"), "const match = 1")
		await fs.writeFile(path.join(tempDir, "code.js"), "const match = 2")

		const results = await executeTool(grepTool, {
			pattern: "match",
			path: tempDir,
			include: "*.ts",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			matchCount: number
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(1)
		expect(finalResult?.result).toContain("code.ts")
		expect(finalResult?.result).not.toContain("code.js")
	})

	it("returns no matches message when pattern not found", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "hello world")

		const results = await executeTool(grepTool, {
			pattern: "notfound",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			matchCount: number
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(0)
		expect(finalResult?.result).toContain("No matches found")
	})

	it("searches nested directories", async () => {
		await fs.mkdir(path.join(tempDir, "subdir"), { recursive: true })
		await fs.writeFile(path.join(tempDir, "subdir", "nested.txt"), "nested match")

		const results = await executeTool(grepTool, {
			pattern: "nested",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			matchCount: number
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(1)
		expect(finalResult?.result).toContain("nested.txt")
	})

	it("yields pending status before completion", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "content")

		const results = await executeTool(grepTool, {
			pattern: "content",
			path: tempDir,
		})

		expect(results.length).toBeGreaterThanOrEqual(2)
		const pendingResult = results[0] as { status: string }
		expect(pendingResult?.status).toBe("pending")
	})

	it("groups results by file", async () => {
		await fs.writeFile(
			path.join(tempDir, "file.txt"),
			"match line 1\nmatch line 2",
		)

		const results = await executeTool(grepTool, {
			pattern: "match",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		// File path should appear once, then multiple line matches
		const filePathMatches = finalResult.result.match(/file\.txt:/g)
		expect(filePathMatches?.length).toBe(1)
	})

	it("includes match count in result", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "match\nmatch\nmatch")

		const results = await executeTool(grepTool, {
			pattern: "match",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			matchCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.matchCount).toBe(3)
		expect(finalResult?.result).toContain("Found 3 matches")
	})

	it("defaults to current directory when path not provided", async () => {
		const results = await executeTool(grepTool, {
			pattern: "somethingUnlikelyToMatch12345",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			searchPath: string
		}
		expect(finalResult?.searchPath).toBe(process.cwd())
	})

	it("trims whitespace from matched lines", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "   match with spaces   ")

		const results = await executeTool(grepTool, {
			pattern: "match",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain("match with spaces")
		// Should be trimmed
		expect(finalResult?.result).not.toMatch(/\s{3}match/)
	})

	it("handles case-sensitive patterns", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "Hello\nhello\nHELLO")

		const results = await executeTool(grepTool, {
			pattern: "Hello",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			matchCount: number
		}
		expect(finalResult?.status).toBe("success")
		// By default ripgrep is case-sensitive
		expect(finalResult?.matchCount).toBe(1)
	})

	it("includes full file path in output", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "match")

		const results = await executeTool(grepTool, {
			pattern: "match",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain(tempDir)
	})
})

