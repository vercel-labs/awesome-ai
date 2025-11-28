import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { listTool } from "../list"
import { executeTool } from "./lib/test-utils"

describe("listTool", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "list-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("lists files in a directory", async () => {
		await fs.writeFile(path.join(tempDir, "file1.txt"), "content1")
		await fs.writeFile(path.join(tempDir, "file2.txt"), "content2")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(2)
		expect(finalResult?.result).toContain("file1.txt")
		expect(finalResult?.result).toContain("file2.txt")
	})

	it("lists files in nested directories", async () => {
		await fs.mkdir(path.join(tempDir, "subdir"), { recursive: true })
		await fs.writeFile(path.join(tempDir, "root.txt"), "root")
		await fs.writeFile(path.join(tempDir, "subdir", "nested.txt"), "nested")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(2)
		expect(finalResult?.result).toContain("root.txt")
		expect(finalResult?.result).toContain("subdir/")
		expect(finalResult?.result).toContain("nested.txt")
	})

	it("displays tree structure", async () => {
		await fs.mkdir(path.join(tempDir, "a"), { recursive: true })
		await fs.mkdir(path.join(tempDir, "b"), { recursive: true })
		await fs.writeFile(path.join(tempDir, "a", "file-a.txt"), "a")
		await fs.writeFile(path.join(tempDir, "b", "file-b.txt"), "b")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		// Tree structure should show directories
		expect(finalResult?.result).toContain("a/")
		expect(finalResult?.result).toContain("b/")
	})

	it("ignores node_modules by default", async () => {
		await fs.mkdir(path.join(tempDir, "node_modules", "pkg"), {
			recursive: true,
		})
		await fs.writeFile(
			path.join(tempDir, "node_modules", "pkg", "index.js"),
			"module",
		)
		await fs.writeFile(path.join(tempDir, "source.ts"), "source")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(1)
		expect(finalResult?.result).toContain("source.ts")
		expect(finalResult?.result).not.toContain("index.js")
	})

	it("ignores .git by default", async () => {
		await fs.mkdir(path.join(tempDir, ".git"), { recursive: true })
		await fs.writeFile(path.join(tempDir, ".git", "config"), "git")
		await fs.writeFile(path.join(tempDir, "source.ts"), "source")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).not.toContain("config")
		expect(finalResult?.result).toContain("source.ts")
	})

	it("accepts additional ignore patterns", async () => {
		await fs.mkdir(path.join(tempDir, "ignored_dir"), { recursive: true })
		await fs.writeFile(path.join(tempDir, "keep.ts"), "keep")
		await fs.writeFile(
			path.join(tempDir, "ignored_dir", "ignored.ts"),
			"ignored",
		)
		await fs.writeFile(path.join(tempDir, "debug.log"), "log file")

		const results = await executeTool(listTool, {
			path: tempDir,
			ignore: ["ignored_dir", "!*.log"],
		})

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(1)
		expect(finalResult?.result).toContain("keep.ts")
		expect(finalResult?.result).not.toContain("ignored.ts")
		expect(finalResult?.result).not.toContain("debug.log")
	})

	it("returns error for non-existent directory", async () => {
		const results = await executeTool(listTool, {
			path: path.join(tempDir, "nonexistent"),
		})

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("not found")
	})

	it("returns error when path is a file", async () => {
		const filePath = path.join(tempDir, "file.txt")
		await fs.writeFile(filePath, "content")

		const results = await executeTool(listTool, { path: filePath })

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("not a directory")
	})

	it("yields pending status before completion", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "content")

		const results = await executeTool(listTool, { path: tempDir })

		expect(results.length).toBeGreaterThanOrEqual(2)
		const pendingResult = results[0] as { status: string }
		expect(pendingResult?.status).toBe("pending")
	})

	it("handles empty directory", async () => {
		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			fileCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.fileCount).toBe(0)
	})

	it("defaults to current directory when path not provided", async () => {
		// This test verifies the tool accepts no path argument
		const results = await executeTool(listTool, {})

		const finalResult = results[results.length - 1] as {
			status: string
			dirPath: string
		}
		// Should succeed or fail based on current directory
		// The important thing is it doesn't throw for missing path
		expect(finalResult?.dirPath).toBe(process.cwd())
	})

	it("includes root path in output", async () => {
		await fs.writeFile(path.join(tempDir, "file.txt"), "content")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain(tempDir)
	})

	it("sorts files alphabetically", async () => {
		await fs.writeFile(path.join(tempDir, "zebra.txt"), "z")
		await fs.writeFile(path.join(tempDir, "apple.txt"), "a")
		await fs.writeFile(path.join(tempDir, "mango.txt"), "m")

		const results = await executeTool(listTool, { path: tempDir })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")

		const appleIndex = finalResult.result.indexOf("apple.txt")
		const mangoIndex = finalResult.result.indexOf("mango.txt")
		const zebraIndex = finalResult.result.indexOf("zebra.txt")

		expect(appleIndex).toBeLessThan(mangoIndex)
		expect(mangoIndex).toBeLessThan(zebraIndex)
	})
})

