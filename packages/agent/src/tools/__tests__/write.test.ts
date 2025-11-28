import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { writeTool } from "../write"
import { executeTool } from "./lib/test-utils"

describe("writeTool", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "write-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("creates a new file", async () => {
		const filePath = path.join(tempDir, "new-file.txt")
		const content = "Hello, world!"

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			wasOverwrite: boolean
			lineCount: number
			byteSize: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.wasOverwrite).toBe(false)
		expect(finalResult?.lineCount).toBe(1)
		expect(finalResult?.byteSize).toBe(Buffer.byteLength(content))

		const written = await fs.readFile(filePath, "utf-8")
		expect(written).toBe(content)
	})

	it("overwrites an existing file", async () => {
		const filePath = path.join(tempDir, "existing.txt")
		await fs.writeFile(filePath, "original content", "utf-8")

		const newContent = "new content"
		const results = await executeTool(writeTool, { filePath, content: newContent })

		const finalResult = results[results.length - 1] as {
			status: string
			wasOverwrite: boolean
			diff?: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.wasOverwrite).toBe(true)
		expect(finalResult?.diff).toBeDefined()
		expect(finalResult?.diff).toContain("-original")
		expect(finalResult?.diff).toContain("+new")

		const written = await fs.readFile(filePath, "utf-8")
		expect(written).toBe(newContent)
	})

	it("creates nested directories if they don't exist", async () => {
		const filePath = path.join(tempDir, "a", "b", "c", "deep-file.txt")
		const content = "deep content"

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as { status: string }
		expect(finalResult?.status).toBe("success")

		const written = await fs.readFile(filePath, "utf-8")
		expect(written).toBe(content)
	})

	it("counts lines correctly", async () => {
		const filePath = path.join(tempDir, "multiline.txt")
		const content = "line1\nline2\nline3"

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			lineCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.lineCount).toBe(3)
	})

	it("calculates byte size correctly for unicode", async () => {
		const filePath = path.join(tempDir, "unicode.txt")
		const content = "Hello 世界 🌍"

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			byteSize: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.byteSize).toBe(Buffer.byteLength(content, "utf-8"))
	})

	it("yields pending status before completion", async () => {
		const filePath = path.join(tempDir, "pending-test.txt")

		const results = await executeTool(writeTool, { filePath, content: "content" })

		expect(results.length).toBeGreaterThanOrEqual(2)
		const pendingResult = results[0] as { status: string }
		expect(pendingResult?.status).toBe("pending")
	})

	it("includes content in success result", async () => {
		const filePath = path.join(tempDir, "content-test.txt")
		const content = "test content here"

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			content: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.content).toBe(content)
	})

	it("does not include diff when content is unchanged", async () => {
		const filePath = path.join(tempDir, "unchanged.txt")
		const content = "same content"
		await fs.writeFile(filePath, content, "utf-8")

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			wasOverwrite: boolean
			diff?: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.wasOverwrite).toBe(true)
		expect(finalResult?.diff).toBeUndefined()
	})

	it("handles empty content", async () => {
		const filePath = path.join(tempDir, "empty.txt")

		const results = await executeTool(writeTool, { filePath, content: "" })

		const finalResult = results[results.length - 1] as {
			status: string
			lineCount: number
			byteSize: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.lineCount).toBe(1) // Empty string still has 1 "line"
		expect(finalResult?.byteSize).toBe(0)

		const written = await fs.readFile(filePath, "utf-8")
		expect(written).toBe("")
	})

	it("handles large content", async () => {
		const filePath = path.join(tempDir, "large.txt")
		const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`)
		const content = lines.join("\n")

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			lineCount: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.lineCount).toBe(1000)

		const written = await fs.readFile(filePath, "utf-8")
		expect(written).toBe(content)
	})

	it("includes result message with file stats", async () => {
		const filePath = path.join(tempDir, "stats.txt")
		const content = "test"

		const results = await executeTool(writeTool, { filePath, content })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain("created")
		expect(finalResult?.result).toContain(filePath)
		expect(finalResult?.result).toContain("lines")
		expect(finalResult?.result).toContain("bytes")
	})

	it("result message shows 'overwritten' for existing files", async () => {
		const filePath = path.join(tempDir, "overwrite-msg.txt")
		await fs.writeFile(filePath, "old", "utf-8")

		const results = await executeTool(writeTool, { filePath, content: "new" })

		const finalResult = results[results.length - 1] as {
			status: string
			result: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.result).toContain("overwritten")
	})
})

