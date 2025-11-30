import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { readTool } from "../read"
import { executeTool } from "./lib/test-utils"

describe("readTool", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "read-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("basic reading", () => {
		it("reads file content with line numbers", async () => {
			const content = "line 1\nline 2\nline 3"
			await fs.writeFile(path.join(tempDir, "test.txt"), content)

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
				linesRead: number
				totalLines: number
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("00001| line 1")
			expect(finalResult?.content).toContain("00002| line 2")
			expect(finalResult?.content).toContain("00003| line 3")
			expect(finalResult?.linesRead).toBe(3)
			expect(finalResult?.totalLines).toBe(3)
		})

		it("wraps content in <file> tags", async () => {
			await fs.writeFile(path.join(tempDir, "test.txt"), "content")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toMatch(/^<file>\n/)
			expect(finalResult?.content).toMatch(/\n<\/file>$/)
		})

		it("shows end of file message", async () => {
			await fs.writeFile(path.join(tempDir, "test.txt"), "line 1\nline 2")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.content).toContain("(End of file - total 2 lines)")
		})

		it("yields pending status before completion", async () => {
			await fs.writeFile(path.join(tempDir, "test.txt"), "content")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 2000,
			})

			expect(results.length).toBeGreaterThanOrEqual(2)
			const pendingResult = results[0] as { status: string }
			expect(pendingResult?.status).toBe("pending")
		})
	})

	describe("offset and limit", () => {
		it("respects offset parameter", async () => {
			const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
			await fs.writeFile(path.join(tempDir, "test.txt"), lines.join("\n"))

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 5,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
				linesRead: number
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("00006| line 6")
			expect(finalResult?.content).not.toContain("00001| line 1")
			expect(finalResult?.linesRead).toBe(5)
		})

		it("respects limit parameter", async () => {
			const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
			await fs.writeFile(path.join(tempDir, "test.txt"), lines.join("\n"))

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 3,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
				linesRead: number
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("00001| line 1")
			expect(finalResult?.content).toContain("00003| line 3")
			expect(finalResult?.content).not.toContain("00004| line 4")
			expect(finalResult?.linesRead).toBe(3)
		})

		it("shows has more lines message when truncated", async () => {
			const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
			await fs.writeFile(path.join(tempDir, "test.txt"), lines.join("\n"))

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 5,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.content).toContain(
				"(File has more lines. Use 'offset' parameter to read beyond line 5)",
			)
		})

		it("combines offset and limit", async () => {
			const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
			await fs.writeFile(path.join(tempDir, "test.txt"), lines.join("\n"))

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 5,
				limit: 3,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
				linesRead: number
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("00006| line 6")
			expect(finalResult?.content).toContain("00008| line 8")
			expect(finalResult?.content).not.toContain("00005| line 5")
			expect(finalResult?.content).not.toContain("00009| line 9")
			expect(finalResult?.linesRead).toBe(3)
		})
	})

	describe("line truncation", () => {
		it("truncates lines longer than 2000 characters", async () => {
			const longLine = "x".repeat(2500)
			await fs.writeFile(path.join(tempDir, "test.txt"), longLine)

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			// Line should be truncated to 2000 chars + "..."
			expect(finalResult?.content).toContain(`${"x".repeat(2000)}...`)
			expect(finalResult?.content).not.toContain("x".repeat(2001))
		})
	})

	describe("path handling", () => {
		it("converts relative paths to absolute", async () => {
			// Create file in cwd
			const testFile = path.join(process.cwd(), "test-relative-read.txt")
			await fs.writeFile(testFile, "content")

			try {
				const results = await executeTool(readTool, {
					filePath: "test-relative-read.txt",
					offset: 0,
					limit: 2000,
				})

				const finalResult = results[results.length - 1] as {
					status: string
					filePath: string
				}
				expect(finalResult?.status).toBe("success")
				expect(path.isAbsolute(finalResult?.filePath)).toBe(true)
			} finally {
				await fs.unlink(testFile)
			}
		})
	})

	describe("sensitive files", () => {
		it("blocks .env files", async () => {
			await fs.writeFile(path.join(tempDir, ".env"), "SECRET=value")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, ".env"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("Cannot read sensitive file")
		})

		it("blocks .env.local files", async () => {
			await fs.writeFile(path.join(tempDir, ".env.local"), "SECRET=value")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, ".env.local"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("Cannot read sensitive file")
		})

		it("allows .env.example files", async () => {
			await fs.writeFile(path.join(tempDir, ".env.example"), "KEY=example")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, ".env.example"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("KEY=example")
		})

		it("allows .env.sample files", async () => {
			await fs.writeFile(path.join(tempDir, ".env.sample"), "KEY=sample")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, ".env.sample"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("KEY=sample")
		})

		it("allows .env.template files", async () => {
			await fs.writeFile(path.join(tempDir, ".env.template"), "KEY=template")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, ".env.template"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("KEY=template")
		})
	})

	describe("error handling", () => {
		it("returns error for non-existent file", async () => {
			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "nonexistent.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("File not found")
		})

		it("suggests similar files when not found", async () => {
			// The suggestion logic matches if one name contains the other
			await fs.writeFile(path.join(tempDir, "component.tsx"), "content")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "component"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("Did you mean")
			expect(finalResult?.error).toContain("component.tsx")
		})

		it("returns error for directory", async () => {
			const subDir = path.join(tempDir, "subdir")
			await fs.mkdir(subDir)

			const results = await executeTool(readTool, {
				filePath: subDir,
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("Path is a directory")
		})
	})

	describe("binary file detection", () => {
		it("rejects known binary extensions", async () => {
			// Create an empty .exe file (extension triggers rejection)
			await fs.writeFile(path.join(tempDir, "test.exe"), "")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "test.exe"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("Cannot read binary file")
		})

		it("rejects files with null bytes", async () => {
			// Create a file with null bytes
			const binaryContent = Buffer.from([
				0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64,
			])
			await fs.writeFile(path.join(tempDir, "binary.dat"), binaryContent)

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "binary.dat"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				error?: string
			}
			expect(finalResult?.status).toBe("error")
			expect(finalResult?.error).toContain("Cannot read binary file")
		})

		it("allows text files with unknown extensions", async () => {
			await fs.writeFile(
				path.join(tempDir, "file.customext"),
				"plain text content",
			)

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "file.customext"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("plain text content")
		})
	})

	describe("empty files", () => {
		it("reads empty files", async () => {
			await fs.writeFile(path.join(tempDir, "empty.txt"), "")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "empty.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				linesRead: number
				totalLines: number
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.linesRead).toBe(1) // Empty file has 1 empty line
			expect(finalResult?.totalLines).toBe(1)
		})
	})

	describe("special characters", () => {
		it("handles files with unicode content", async () => {
			const unicodeContent = "Hello 世界 🌍 Привет"
			await fs.writeFile(path.join(tempDir, "unicode.txt"), unicodeContent)

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, "unicode.txt"),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("Hello 世界 🌍 Привет")
		})

		it("handles files with special characters in filename", async () => {
			const filename = "file with spaces & symbols!.txt"
			await fs.writeFile(path.join(tempDir, filename), "content")

			const results = await executeTool(readTool, {
				filePath: path.join(tempDir, filename),
				offset: 0,
				limit: 2000,
			})

			const finalResult = results[results.length - 1] as {
				status: string
				content: string
			}
			expect(finalResult?.status).toBe("success")
			expect(finalResult?.content).toContain("content")
		})
	})
})
