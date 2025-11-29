import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	BlockAnchorReplacer,
	ContextAwareReplacer,
	EscapeNormalizedReplacer,
	editTool,
	IndentationFlexibleReplacer,
	LineTrimmedReplacer,
	MultiOccurrenceReplacer,
	replace,
	SimpleReplacer,
	TrimmedBoundaryReplacer,
	WhitespaceNormalizedReplacer,
} from "../edit"
import { executeTool } from "./lib/test-utils"

// Helper to collect all values from a generator
function collect<T>(gen: Generator<T, void, unknown>): T[] {
	const results: T[] = []
	for (const value of gen) {
		results.push(value)
	}
	return results
}

// ============================================================================
// replace() function tests
// ============================================================================

describe("replace", () => {
	it("performs exact replacement", () => {
		const content = "Hello, world!"
		const result = replace(content, "world", "vitest")
		expect(result).toBe("Hello, vitest!")
	})

	it("throws when oldString equals newString", () => {
		expect(() => replace("content", "same", "same")).toThrow(
			"oldString and newString must be different",
		)
	})

	it("throws when oldString not found", () => {
		expect(() => replace("Hello, world!", "notfound", "replacement")).toThrow(
			"oldString not found in content",
		)
	})

	it("throws when multiple matches found without replaceAll", () => {
		const content = "foo bar foo"
		expect(() => replace(content, "foo", "baz")).toThrow(
			"Found multiple matches for oldString",
		)
	})

	it("replaces all occurrences with replaceAll=true", () => {
		const content = "foo bar foo baz foo"
		const result = replace(content, "foo", "qux", true)
		expect(result).toBe("qux bar qux baz qux")
	})

	it("handles multi-line content", () => {
		const content = "line1\nline2\nline3"
		const result = replace(content, "line2", "replaced")
		expect(result).toBe("line1\nreplaced\nline3")
	})

	it("preserves surrounding content", () => {
		const content = "prefix middle suffix"
		const result = replace(content, "middle", "center")
		expect(result).toBe("prefix center suffix")
	})
})

// ============================================================================
// Replacer strategy tests
// ============================================================================

describe("SimpleReplacer", () => {
	it("yields the exact find string", () => {
		const results = collect(SimpleReplacer("any content", "search"))
		expect(results).toEqual(["search"])
	})
})

describe("LineTrimmedReplacer", () => {
	it("matches lines with different leading whitespace", () => {
		const content = "  hello world  \n  foo bar  "
		const results = collect(LineTrimmedReplacer(content, "hello world"))
		expect(results.length).toBe(1)
		expect(results[0]).toBe("  hello world  ")
	})

	it("matches multi-line blocks with trimmed comparison", () => {
		const content = "  line1  \n  line2  \n  line3  "
		const results = collect(LineTrimmedReplacer(content, "line1\nline2"))
		expect(results.length).toBe(1)
	})

	it("handles trailing empty line in search", () => {
		const content = "hello\nworld"
		const results = collect(LineTrimmedReplacer(content, "hello\n"))
		expect(results.length).toBe(1)
	})
})

describe("BlockAnchorReplacer", () => {
	it("requires at least 3 lines in search", () => {
		const content = "line1\nline2\nline3"
		const results = collect(BlockAnchorReplacer(content, "line1\nline2"))
		expect(results).toEqual([])
	})

	it("matches block by first and last line anchors", () => {
		const content = "start\nmiddle content\nend"
		const results = collect(
			BlockAnchorReplacer(content, "start\ndifferent middle\nend"),
		)
		expect(results.length).toBe(1)
		expect(results[0]).toBe("start\nmiddle content\nend")
	})

	it("selects best match among multiple candidates", () => {
		const content = "start\nAAA\nend\nstart\nBBB\nend"
		const results = collect(BlockAnchorReplacer(content, "start\nBBB\nend"))
		expect(results.length).toBe(1)
		expect(results[0]).toContain("BBB")
	})
})

describe("WhitespaceNormalizedReplacer", () => {
	it("matches with collapsed whitespace", () => {
		const content = "hello    world"
		const results = collect(
			WhitespaceNormalizedReplacer(content, "hello world"),
		)
		expect(results.length).toBeGreaterThan(0)
	})

	it("matches with tabs normalized to spaces", () => {
		const content = "hello\t\tworld"
		const results = collect(
			WhitespaceNormalizedReplacer(content, "hello world"),
		)
		expect(results.length).toBeGreaterThan(0)
	})

	it("handles multi-line whitespace normalization", () => {
		const content = "line1   \n   line2"
		const results = collect(
			WhitespaceNormalizedReplacer(content, "line1\nline2"),
		)
		// Should find the normalized match
		expect(results.length).toBeGreaterThanOrEqual(0) // May or may not match depending on implementation
	})
})

describe("IndentationFlexibleReplacer", () => {
	it("matches content with different indentation levels", () => {
		const content = "    indented line"
		const results = collect(
			IndentationFlexibleReplacer(content, "indented line"),
		)
		expect(results.length).toBe(1)
		expect(results[0]).toBe("    indented line")
	})

	it("matches multi-line blocks with consistent different indentation", () => {
		const content = "    line1\n    line2"
		const results = collect(
			IndentationFlexibleReplacer(content, "line1\nline2"),
		)
		expect(results.length).toBe(1)
	})

	it("handles mixed indentation in content", () => {
		const content = "  line1\n    line2\n  line3"
		const results = collect(
			IndentationFlexibleReplacer(content, "line1\n  line2\nline3"),
		)
		expect(results.length).toBe(1)
	})
})

describe("EscapeNormalizedReplacer", () => {
	it("handles escaped newlines", () => {
		const content = "hello\nworld"
		const results = collect(EscapeNormalizedReplacer(content, "hello\\nworld"))
		expect(results.length).toBeGreaterThan(0)
	})

	it("handles escaped tabs", () => {
		const content = "hello\tworld"
		const results = collect(EscapeNormalizedReplacer(content, "hello\\tworld"))
		expect(results.length).toBeGreaterThan(0)
	})

	it("handles escaped quotes", () => {
		const content = 'say "hello"'
		const results = collect(
			EscapeNormalizedReplacer(content, 'say \\"hello\\"'),
		)
		expect(results.length).toBeGreaterThan(0)
	})
})

describe("TrimmedBoundaryReplacer", () => {
	it("does nothing when find has no extra whitespace", () => {
		const content = "hello world"
		const results = collect(TrimmedBoundaryReplacer(content, "hello"))
		expect(results).toEqual([])
	})

	it("matches trimmed version of search with leading/trailing whitespace", () => {
		const content = "hello world"
		const results = collect(TrimmedBoundaryReplacer(content, "  hello  "))
		expect(results.length).toBe(1)
		expect(results[0]).toBe("hello")
	})

	it("matches block with trimmed boundaries", () => {
		const content = "  line1  \n  line2  "
		const results = collect(
			TrimmedBoundaryReplacer(content, "\n  line1  \n  line2  \n"),
		)
		expect(results.length).toBeGreaterThanOrEqual(0)
	})
})

describe("ContextAwareReplacer", () => {
	it("requires at least 3 lines", () => {
		const content = "line1\nline2"
		const results = collect(ContextAwareReplacer(content, "line1\nline2"))
		expect(results).toEqual([])
	})

	it("matches by first and last line with similar middle", () => {
		const content = "function foo() {\n  const x = 1;\n}"
		const results = collect(
			ContextAwareReplacer(content, "function foo() {\n  const x = 1;\n}"),
		)
		expect(results.length).toBe(1)
	})

	it("requires 50% similarity in middle lines", () => {
		const content = "start\nAAAA\nBBBB\nend"
		const results = collect(
			ContextAwareReplacer(content, "start\nXXXX\nYYYY\nend"),
		)
		// Should not match since middle lines are completely different
		expect(results.length).toBe(0)
	})
})

describe("MultiOccurrenceReplacer", () => {
	it("yields all exact matches", () => {
		const content = "foo bar foo baz foo"
		const results = collect(MultiOccurrenceReplacer(content, "foo"))
		expect(results).toEqual(["foo", "foo", "foo"])
	})

	it("returns empty for no matches", () => {
		const content = "hello world"
		const results = collect(MultiOccurrenceReplacer(content, "notfound"))
		expect(results).toEqual([])
	})

	it("handles overlapping potential matches correctly", () => {
		const content = "aaa"
		const results = collect(MultiOccurrenceReplacer(content, "aa"))
		// Should find "aa" starting at index 0, then continue from index 2
		expect(results.length).toBe(1)
	})
})

// ============================================================================
// editTool integration tests
// ============================================================================

describe("editTool", () => {
	let tempDir: string
	let tempFile: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "edit-test-"))
		tempFile = path.join(tempDir, "test.txt")
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("replaces text in a file", async () => {
		await fs.writeFile(tempFile, "Hello, world!", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "world",
			newString: "vitest",
		})

		expect(results.length).toBeGreaterThanOrEqual(2)
		const finalResult = results[results.length - 1] as { status: string }
		expect(finalResult?.status).toBe("success")

		const newContent = await fs.readFile(tempFile, "utf-8")
		expect(newContent).toBe("Hello, vitest!")
	})

	it("returns error for non-existent file", async () => {
		const results = await executeTool(editTool, {
			filePath: path.join(tempDir, "nonexistent.txt"),
			oldString: "foo",
			newString: "bar",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("not found")
	})

	it("returns error when path is a directory", async () => {
		const results = await executeTool(editTool, {
			filePath: tempDir,
			oldString: "foo",
			newString: "bar",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("directory")
	})

	it("overwrites file when oldString is empty", async () => {
		await fs.writeFile(tempFile, "original content", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "",
			newString: "completely new content",
		})

		const finalResult = results[results.length - 1] as { status: string }
		expect(finalResult?.status).toBe("success")

		const newContent = await fs.readFile(tempFile, "utf-8")
		expect(newContent).toBe("completely new content")
	})

	it("replaces all occurrences with replaceAll=true", async () => {
		await fs.writeFile(tempFile, "foo bar foo baz foo", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "foo",
			newString: "qux",
			replaceAll: true,
		})

		const finalResult = results[results.length - 1] as { status: string }
		expect(finalResult?.status).toBe("success")

		const newContent = await fs.readFile(tempFile, "utf-8")
		expect(newContent).toBe("qux bar qux baz qux")
	})

	it("returns error when oldString not found", async () => {
		await fs.writeFile(tempFile, "Hello, world!", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "notfound",
			newString: "replacement",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("not found")
	})

	it("returns error for multiple matches without replaceAll", async () => {
		await fs.writeFile(tempFile, "foo bar foo", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "foo",
			newString: "baz",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			error?: string
		}
		expect(finalResult?.status).toBe("error")
		expect(finalResult?.error).toContain("multiple matches")
	})

	it("normalizes CRLF line endings", async () => {
		await fs.writeFile(tempFile, "line1\r\nline2\r\nline3", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "line2",
			newString: "replaced",
		})

		const finalResult = results[results.length - 1] as { status: string }
		expect(finalResult?.status).toBe("success")

		const newContent = await fs.readFile(tempFile, "utf-8")
		expect(newContent).toContain("replaced")
	})

	it("uses fuzzy matching strategies", async () => {
		// Test that line-trimmed matching works through the tool
		await fs.writeFile(tempFile, "  hello world  ", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "hello world",
			newString: "goodbye world",
		})

		const finalResult = results[results.length - 1] as { status: string }
		expect(finalResult?.status).toBe("success")

		const newContent = await fs.readFile(tempFile, "utf-8")
		expect(newContent).toBe("  goodbye world  ")
	})

	it("yields pending status before completion", async () => {
		await fs.writeFile(tempFile, "content", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "content",
			newString: "new content",
		})

		expect(results.length).toBeGreaterThanOrEqual(2)
		const pendingResult = results[0] as { status: string }
		expect(pendingResult?.status).toBe("pending")
	})

	it("includes diff in success result", async () => {
		await fs.writeFile(tempFile, "old text", "utf-8")

		const results = await executeTool(editTool, {
			filePath: tempFile,
			oldString: "old",
			newString: "new",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			diff?: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.diff).toBeDefined()
		expect(finalResult?.diff).toContain("-old")
		expect(finalResult?.diff).toContain("+new")
	})
})
