import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { globTool } from "../glob"
import { executeTool } from "./lib/test-utils"

describe("globTool", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glob-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("finds files in nested directories", async () => {
		await fs.mkdir(path.join(tempDir, "subdir"), { recursive: true })
		await fs.writeFile(path.join(tempDir, "root.nestedtest"), "root")
		await fs.writeFile(
			path.join(tempDir, "subdir", "nested.nestedtest"),
			"nested",
		)

		const results = await executeTool(globTool, {
			pattern: "**/*.nestedtest",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(2)
		expect(finalResult?.result).toContain("root.nestedtest")
		expect(finalResult?.result).toContain("nested.nestedtest")
	})

	it("supports brace expansion", async () => {
		await fs.writeFile(path.join(tempDir, "file.ts"), "ts")
		await fs.writeFile(path.join(tempDir, "file.js"), "js")
		await fs.writeFile(path.join(tempDir, "file.css"), "css")

		const results = await executeTool(globTool, {
			pattern: "*.{ts,js}",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(2)
		expect(finalResult?.result).toContain("file.ts")
		expect(finalResult?.result).toContain("file.js")
		expect(finalResult?.result).not.toContain("file.css")
	})

	it("supports character classes", async () => {
		await fs.writeFile(path.join(tempDir, "data1.log"), "1")
		await fs.writeFile(path.join(tempDir, "data2.log"), "2")
		await fs.writeFile(path.join(tempDir, "dataA.log"), "A")

		const results = await executeTool(globTool, {
			pattern: "data[0-9].log",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(2)
		expect(finalResult?.result).toContain("data1.log")
		expect(finalResult?.result).toContain("data2.log")
		expect(finalResult?.result).not.toContain("dataA.log")
	})

	it("returns full file paths", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "content")

		const results = await executeTool(globTool, {
			pattern: "*.txt",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain(tempDir)
		expect(finalResult?.result).toContain(path.join(tempDir, "file.txt"))
	})

	it("returns no files found message when no matches", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "content")

		const results = await executeTool(globTool, {
			pattern: "*.xyz",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(0)
		expect(finalResult?.result).toContain("No files found")
	})

	it("yields pending status before completion", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "content")

		const results = await executeTool(globTool, {
			pattern: "*.txt",
			path: tempDir,
		})

		expect(results.length).toBeGreaterThanOrEqual(2)
		const pendingResult = results[0] as { status: string }
		expect(pendingResult?.status).toBe("pending")
	})

	it("returns error for non-existent directory", async () => {
		const results = await executeTool(globTool, {
			pattern: "*.txt",
			path: path.join(tempDir, "nonexistent"),
		})

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("not found")
	})

	it("defaults to current directory when path not provided", async () => {
		const results = await executeTool(globTool, {
			pattern: "*.unlikelyextension12345",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			searchPath: string
		}
		expect(finalResult?.searchPath).toBe(process.cwd())
	})

	it("finds hidden files", async () => {
		await fs.writeFile(path.join(tempDir, ".hidden"), "hidden")
		await fs.writeFile(path.join(tempDir, "visible.txt"), "visible")

		const results = await executeTool(globTool, {
			pattern: ".*",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(1)
		expect(finalResult?.result).toContain(".hidden")
	})

	it("matches files with specific names", async () => {
		await fs.writeFile(path.join(tempDir, "package.json"), "{}")
		await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}")
		await fs.writeFile(path.join(tempDir, "other.json"), "{}")

		const results = await executeTool(globTool, {
			pattern: "package.json",
			path: tempDir,
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(1)
		expect(finalResult?.result).toContain("package.json")
	})
})
