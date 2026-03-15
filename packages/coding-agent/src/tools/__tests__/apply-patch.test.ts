import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { applyPatchTool } from "../apply-patch"
import { executeTool } from "./lib/test-utils"

describe("applyPatchTool", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "apply-patch-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("adds a file", async () => {
		const filePath = path.join(tempDir, "new.txt")
		const patchText = `*** Begin Patch
*** Add File: ${filePath}
+hello
+world
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as { status: string }
		expect(final.status).toBe("success")
		expect(await fs.readFile(filePath, "utf-8")).toBe("hello\nworld\n")
	})

	it("updates a file", async () => {
		const filePath = path.join(tempDir, "a.txt")
		await fs.writeFile(filePath, "a\nb\nc\n", "utf-8")
		const patchText = `*** Begin Patch
*** Update File: ${filePath}
@@
 a
-b
+B
 c
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as { status: string }
		expect(final.status).toBe("success")
		expect(await fs.readFile(filePath, "utf-8")).toBe("a\nB\nc\n")
	})

	it("deletes a file", async () => {
		const filePath = path.join(tempDir, "gone.txt")
		await fs.writeFile(filePath, "gone\n", "utf-8")
		const patchText = `*** Begin Patch
*** Delete File: ${filePath}
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as { status: string }
		expect(final.status).toBe("success")
		await expect(fs.stat(filePath)).rejects.toThrow()
	})

	it("reports verification errors for malformed patches", async () => {
		const filePath = path.join(tempDir, "bad.txt")
		const patchText = `*** Begin Patch
*** Add File: ${filePath}
hello
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(final.status).toBe("error")
		expect(final.error).toContain("apply_patch verification failed")
	})

	it("handles move and update in a single operation", async () => {
		const from = path.join(tempDir, "from.txt")
		const to = path.join(tempDir, "to.txt")
		await fs.writeFile(from, "a\nb\nc\n", "utf-8")
		const patchText = `*** Begin Patch
*** Update File: ${from}
*** Move to: ${to}
@@
 a
-b
+B
 c
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as { status: string }
		expect(final.status).toBe("success")
		await expect(fs.stat(from)).rejects.toThrow()
		expect(await fs.readFile(to, "utf-8")).toBe("a\nB\nc\n")
	})

	it("fails cleanly on ambiguous repeated context", async () => {
		const filePath = path.join(tempDir, "repeat.txt")
		await fs.writeFile(filePath, "x\na\nb\na\nb\nz\n", "utf-8")
		const patchText = `*** Begin Patch
*** Update File: ${filePath}
@@
 a
-c
+C
 b
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(final.status).toBe("error")
		expect(final.error).toContain("apply_patch verification failed")
	})

	it("updates content at eof without trailing newline", async () => {
		const filePath = path.join(tempDir, "eof.txt")
		await fs.writeFile(filePath, "a\nb\nc", "utf-8")
		const patchText = `*** Begin Patch
*** Update File: ${filePath}
@@
 b
-c
+C
*** End Patch`
		const results = await executeTool(applyPatchTool, { patchText })
		const final = results[results.length - 1] as { status: string }
		expect(final.status).toBe("success")
		expect(await fs.readFile(filePath, "utf-8")).toBe("a\nb\nC\n")
	})
})
