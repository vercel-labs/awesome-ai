import { diffLines } from "diff"
import { describe, expect, it } from "vitest"
import { formatDiffWithContext } from "../utils/update-files"

describe("formatDiffWithContext", () => {
	it("returns empty array when there are no changes", () => {
		const oldText = "line 1\nline 2\nline 3\n"
		const newText = "line 1\nline 2\nline 3\n"
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		expect(result).toEqual([])
	})

	it("shows added lines with + prefix", () => {
		const oldText = "line 1\n"
		const newText = "line 1\nline 2\n"
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		expect(result).toContainEqual("+ line 2")
	})

	it("shows removed lines with - prefix", () => {
		const oldText = "line 1\nline 2\n"
		const newText = "line 1\n"
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		expect(result).toContainEqual("- line 2")
	})

	it("shows context lines with 2-space prefix", () => {
		const oldText = "context\nold line\n"
		const newText = "context\nnew line\n"
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		expect(result).toContainEqual("  context")
	})

	it("hides lines at the start of file before changes", () => {
		// Create a file with many lines at the start before the change
		const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
		const oldText = `${[...lines, "old content"].join("\n")}\n`
		const newText = `${[...lines, "new content"].join("\n")}\n`
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		// Should show "lines hidden" message
		expect(result.some((line) => line.includes("lines hidden"))).toBe(true)
		// Should show last 3 context lines before the change
		expect(result).toContainEqual("  line 18")
		expect(result).toContainEqual("  line 19")
		expect(result).toContainEqual("  line 20")
		// Should NOT show early lines
		expect(result).not.toContainEqual("  line 1")
		expect(result).not.toContainEqual("  line 5")
	})

	it("hides lines at the end of file after changes", () => {
		// Create a file with many lines at the end after the change
		const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
		const oldText = `${["old content", ...lines].join("\n")}\n`
		const newText = `${["new content", ...lines].join("\n")}\n`
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		// Should show "lines hidden" message
		expect(result.some((line) => line.includes("lines hidden"))).toBe(true)
		// Should show first 3 context lines after the change
		expect(result).toContainEqual("  line 1")
		expect(result).toContainEqual("  line 2")
		expect(result).toContainEqual("  line 3")
		// Should NOT show late lines
		expect(result).not.toContainEqual("  line 15")
		expect(result).not.toContainEqual("  line 20")
	})

	it("hides lines between two separate changes", () => {
		// Create a file with two changes separated by many unchanged lines
		const middleLines = Array.from({ length: 20 }, (_, i) => `middle ${i + 1}`)
		const oldText = `${["first old", ...middleLines, "last old"].join("\n")}\n`
		const newText = `${["first new", ...middleLines, "last new"].join("\n")}\n`
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		// Should show "lines hidden" message for middle section
		expect(result.some((line) => line.includes("lines hidden"))).toBe(true)
		// Should show first 3 context lines after first change
		expect(result).toContainEqual("  middle 1")
		expect(result).toContainEqual("  middle 2")
		expect(result).toContainEqual("  middle 3")
		// Should show last 3 context lines before second change
		expect(result).toContainEqual("  middle 18")
		expect(result).toContainEqual("  middle 19")
		expect(result).toContainEqual("  middle 20")
		// Should NOT show middle lines
		expect(result).not.toContainEqual("  middle 10")
	})

	it("shows all lines when section is small enough", () => {
		// Create a file with a small unchanged section (less than 7 lines)
		const middleLines = ["a", "b", "c", "d", "e"]
		const oldText = `${["old", ...middleLines, "old2"].join("\n")}\n`
		const newText = `${["new", ...middleLines, "new2"].join("\n")}\n`
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		// Should NOT show "lines hidden" - section is small enough
		expect(result.some((line) => line.includes("lines hidden"))).toBe(false)
		// Should show all middle lines
		for (const line of middleLines) {
			expect(result).toContainEqual(`  ${line}`)
		}
	})

	it("respects custom context lines parameter", () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
		const oldText = `${[...lines, "old content"].join("\n")}\n`
		const newText = `${[...lines, "new content"].join("\n")}\n`
		const diff = diffLines(oldText, newText)

		// Use only 1 context line
		const result = formatDiffWithContext(diff, 1)

		// Should show only line 20 as context (1 line before change)
		expect(result).toContainEqual("  line 20")
		expect(result).not.toContainEqual("  line 19")
		expect(result).not.toContainEqual("  line 18")
	})

	it("correctly calculates hidden line count", () => {
		// 10 lines before the change, with 3 context lines shown = 7 hidden
		const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
		const oldText = `${[...lines, "old"].join("\n")}\n`
		const newText = `${[...lines, "new"].join("\n")}\n`
		const diff = diffLines(oldText, newText)

		const result = formatDiffWithContext(diff)

		// Should say "7 lines hidden" (10 - 3 = 7)
		expect(result.some((line) => line.includes("7 lines hidden"))).toBe(true)
	})
})
