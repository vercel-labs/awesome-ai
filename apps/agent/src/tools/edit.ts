import { tool } from "ai"
import { createTwoFilesPatch } from "diff"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import {
	checkPermission,
	type Permission,
	PermissionDeniedError,
} from "@/agents/lib/permissions"
import { toolOutput } from "@/tools/lib/tool-output"
import { trimDiff } from "@/tools/lib/trim-diff"

// ============================================================================
// Replacement Strategies
// These strategies are sourced from:
// - https://github.com/sst/opencode/blob/dev/packages/opencode/src/tool/edit.ts
// - https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-23-25.ts
// - https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/editCorrector.ts
// ============================================================================

/**
 * A replacer is a generator that yields possible matches for a search string.
 * Each yielded string is a candidate that might be found in the content.
 */
export type Replacer = (
	content: string,
	find: string,
) => Generator<string, void, unknown>

// Similarity thresholds for block anchor fallback matching
const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.0
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3

/**
 * Levenshtein distance algorithm for fuzzy string matching
 */
function levenshtein(a: string, b: string): number {
	if (a === "" || b === "") {
		return Math.max(a.length, b.length)
	}

	const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
		Array.from({ length: b.length + 1 }, (_, j) =>
			i === 0 ? j : j === 0 ? i : 0,
		),
	)

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			matrix[i]![j] = Math.min(
				matrix[i - 1]![j]! + 1,
				matrix[i]![j - 1]! + 1,
				matrix[i - 1]![j - 1]! + cost,
			)
		}
	}

	return matrix[a.length]![b.length]!
}

/**
 * Strategy 1: Simple exact match
 */
export const SimpleReplacer: Replacer = function* (_content, find) {
	yield find
}

/**
 * Strategy 2: Line-trimmed match
 * Matches content where each line's trimmed version matches
 */
export const LineTrimmedReplacer: Replacer = function* (content, find) {
	const originalLines = content.split("\n")
	const searchLines = find.split("\n")

	if (searchLines[searchLines.length - 1] === "") {
		searchLines.pop()
	}

	for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
		let matches = true

		for (let j = 0; j < searchLines.length; j++) {
			const originalTrimmed = originalLines[i + j]?.trim()
			const searchTrimmed = searchLines[j]?.trim()

			if (originalTrimmed !== searchTrimmed) {
				matches = false
				break
			}
		}

		if (matches) {
			let matchStartIndex = 0
			for (let k = 0; k < i; k++) {
				matchStartIndex += originalLines[k]!.length + 1
			}

			let matchEndIndex = matchStartIndex
			for (let k = 0; k < searchLines.length; k++) {
				matchEndIndex += originalLines[i + k]!.length
				if (k < searchLines.length - 1) {
					matchEndIndex += 1
				}
			}

			yield content.substring(matchStartIndex, matchEndIndex)
		}
	}
}

/**
 * Strategy 3: Block anchor matching with Levenshtein distance
 * Matches blocks by first/last line with fuzzy middle content
 */
export const BlockAnchorReplacer: Replacer = function* (content, find) {
	const originalLines = content.split("\n")
	const searchLines = find.split("\n")

	if (searchLines.length < 3) {
		return
	}

	if (searchLines[searchLines.length - 1] === "") {
		searchLines.pop()
	}

	const firstLineSearch = searchLines[0]!.trim()
	const lastLineSearch = searchLines[searchLines.length - 1]!.trim()
	const searchBlockSize = searchLines.length

	// Collect all candidate positions where both anchors match
	const candidates: Array<{ startLine: number; endLine: number }> = []
	for (let i = 0; i < originalLines.length; i++) {
		if (originalLines[i]!.trim() !== firstLineSearch) {
			continue
		}

		// Look for the matching last line after this first line
		for (let j = i + 2; j < originalLines.length; j++) {
			if (originalLines[j]!.trim() === lastLineSearch) {
				candidates.push({ startLine: i, endLine: j })
				break
			}
		}
	}

	if (candidates.length === 0) {
		return
	}

	// Handle single candidate scenario (using relaxed threshold)
	if (candidates.length === 1) {
		const { startLine, endLine } = candidates[0]!
		const actualBlockSize = endLine - startLine + 1

		let similarity = 0
		const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

		if (linesToCheck > 0) {
			for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
				const originalLine = originalLines[startLine + j]!.trim()
				const searchLine = searchLines[j]!.trim()
				const maxLen = Math.max(originalLine.length, searchLine.length)
				if (maxLen === 0) {
					continue
				}
				const distance = levenshtein(originalLine, searchLine)
				similarity += (1 - distance / maxLen) / linesToCheck

				if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
					break
				}
			}
		} else {
			similarity = 1.0
		}

		if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
			let matchStartIndex = 0
			for (let k = 0; k < startLine; k++) {
				matchStartIndex += originalLines[k]!.length + 1
			}
			let matchEndIndex = matchStartIndex
			for (let k = startLine; k <= endLine; k++) {
				matchEndIndex += originalLines[k]!.length
				if (k < endLine) {
					matchEndIndex += 1
				}
			}
			yield content.substring(matchStartIndex, matchEndIndex)
		}
		return
	}

	// Calculate similarity for multiple candidates
	let bestMatch: { startLine: number; endLine: number } | null = null
	let maxSimilarity = -1

	for (const candidate of candidates) {
		const { startLine, endLine } = candidate
		const actualBlockSize = endLine - startLine + 1

		let similarity = 0
		const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

		if (linesToCheck > 0) {
			for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
				const originalLine = originalLines[startLine + j]!.trim()
				const searchLine = searchLines[j]!.trim()
				const maxLen = Math.max(originalLine.length, searchLine.length)
				if (maxLen === 0) {
					continue
				}
				const distance = levenshtein(originalLine, searchLine)
				similarity += 1 - distance / maxLen
			}
			similarity /= linesToCheck
		} else {
			similarity = 1.0
		}

		if (similarity > maxSimilarity) {
			maxSimilarity = similarity
			bestMatch = candidate
		}
	}

	if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
		const { startLine, endLine } = bestMatch
		let matchStartIndex = 0
		for (let k = 0; k < startLine; k++) {
			matchStartIndex += originalLines[k]!.length + 1
		}
		let matchEndIndex = matchStartIndex
		for (let k = startLine; k <= endLine; k++) {
			matchEndIndex += originalLines[k]!.length
			if (k < endLine) {
				matchEndIndex += 1
			}
		}
		yield content.substring(matchStartIndex, matchEndIndex)
	}
}

/**
 * Strategy 4: Whitespace normalized matching
 * Collapses multiple spaces/tabs to single space
 */
export const WhitespaceNormalizedReplacer: Replacer = function* (
	content,
	find,
) {
	const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim()
	const normalizedFind = normalizeWhitespace(find)

	const lines = content.split("\n")
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!
		if (normalizeWhitespace(line) === normalizedFind) {
			yield line
		} else {
			const normalizedLine = normalizeWhitespace(line)
			if (normalizedLine.includes(normalizedFind)) {
				const words = find.trim().split(/\s+/)
				if (words.length > 0) {
					const pattern = words
						.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
						.join("\\s+")
					try {
						const regex = new RegExp(pattern)
						const match = line.match(regex)
						if (match) {
							yield match[0]
						}
					} catch {
						// Invalid regex pattern, skip
					}
				}
			}
		}
	}

	// Handle multi-line matches
	const findLines = find.split("\n")
	if (findLines.length > 1) {
		for (let i = 0; i <= lines.length - findLines.length; i++) {
			const block = lines.slice(i, i + findLines.length)
			if (normalizeWhitespace(block.join("\n")) === normalizedFind) {
				yield block.join("\n")
			}
		}
	}
}

/**
 * Strategy 5: Indentation flexible matching
 * Matches content regardless of indentation level
 */
export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
	const removeIndentation = (text: string) => {
		const lines = text.split("\n")
		const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
		if (nonEmptyLines.length === 0) return text

		const minIndent = Math.min(
			...nonEmptyLines.map((line) => {
				const match = line.match(/^(\s*)/)
				return match ? match[1]!.length : 0
			}),
		)

		return lines
			.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent)))
			.join("\n")
	}

	const normalizedFind = removeIndentation(find)
	const contentLines = content.split("\n")
	const findLines = find.split("\n")

	for (let i = 0; i <= contentLines.length - findLines.length; i++) {
		const block = contentLines.slice(i, i + findLines.length).join("\n")
		if (removeIndentation(block) === normalizedFind) {
			yield block
		}
	}
}

/**
 * Strategy 6: Escape normalized matching
 * Handles escape sequences like \n, \t in search strings
 */
export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
	const unescapeString = (str: string): string => {
		return str.replace(
			/\\(n|t|r|'|"|`|\\|\n|\$)/g,
			(match, capturedChar: string) => {
				switch (capturedChar) {
					case "n":
						return "\n"
					case "t":
						return "\t"
					case "r":
						return "\r"
					case "'":
						return "'"
					case '"':
						return '"'
					case "`":
						return "`"
					case "\\":
						return "\\"
					case "\n":
						return "\n"
					case "$":
						return "$"
					default:
						return match
				}
			},
		)
	}

	const unescapedFind = unescapeString(find)

	if (content.includes(unescapedFind)) {
		yield unescapedFind
	}

	const lines = content.split("\n")
	const findLines = unescapedFind.split("\n")

	for (let i = 0; i <= lines.length - findLines.length; i++) {
		const block = lines.slice(i, i + findLines.length).join("\n")
		const unescapedBlock = unescapeString(block)

		if (unescapedBlock === unescapedFind) {
			yield block
		}
	}
}

/**
 * Strategy 7: Trimmed boundary matching
 * Matches trimmed versions of the search string
 */
export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
	const trimmedFind = find.trim()

	if (trimmedFind === find) {
		return
	}

	if (content.includes(trimmedFind)) {
		yield trimmedFind
	}

	const lines = content.split("\n")
	const findLines = find.split("\n")

	for (let i = 0; i <= lines.length - findLines.length; i++) {
		const block = lines.slice(i, i + findLines.length).join("\n")

		if (block.trim() === trimmedFind) {
			yield block
		}
	}
}

/**
 * Strategy 8: Context-aware matching
 * Uses first/last lines as context anchors with similarity check
 */
export const ContextAwareReplacer: Replacer = function* (content, find) {
	const findLines = find.split("\n")
	if (findLines.length < 3) {
		return
	}

	if (findLines[findLines.length - 1] === "") {
		findLines.pop()
	}

	const contentLines = content.split("\n")
	const firstLine = findLines[0]!.trim()
	const lastLine = findLines[findLines.length - 1]!.trim()

	for (let i = 0; i < contentLines.length; i++) {
		if (contentLines[i]!.trim() !== firstLine) continue

		for (let j = i + 2; j < contentLines.length; j++) {
			if (contentLines[j]!.trim() === lastLine) {
				const blockLines = contentLines.slice(i, j + 1)
				const block = blockLines.join("\n")

				if (blockLines.length === findLines.length) {
					let matchingLines = 0
					let totalNonEmptyLines = 0

					for (let k = 1; k < blockLines.length - 1; k++) {
						const blockLine = blockLines[k]!.trim()
						const findLine = findLines[k]!.trim()

						if (blockLine.length > 0 || findLine.length > 0) {
							totalNonEmptyLines++
							if (blockLine === findLine) {
								matchingLines++
							}
						}
					}

					if (
						totalNonEmptyLines === 0 ||
						matchingLines / totalNonEmptyLines >= 0.5
					) {
						yield block
						break
					}
				}
				break
			}
		}
	}
}

/**
 * Strategy 9: Multi-occurrence matching
 * Yields all exact matches for replaceAll scenarios
 */
export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
	let startIndex = 0

	while (true) {
		const index = content.indexOf(find, startIndex)
		if (index === -1) break

		yield find
		startIndex = index + find.length
	}
}

/**
 * All replacement strategies in order of preference
 */
const REPLACERS: Replacer[] = [
	SimpleReplacer,
	LineTrimmedReplacer,
	BlockAnchorReplacer,
	WhitespaceNormalizedReplacer,
	IndentationFlexibleReplacer,
	EscapeNormalizedReplacer,
	TrimmedBoundaryReplacer,
	ContextAwareReplacer,
	MultiOccurrenceReplacer,
]

/**
 * Try all replacement strategies to find and replace content
 */
export function replace(
	content: string,
	oldString: string,
	newString: string,
	replaceAll = false,
): string {
	if (oldString === newString) {
		throw new Error("oldString and newString must be different")
	}

	let notFound = true

	for (const replacer of REPLACERS) {
		for (const search of replacer(content, oldString)) {
			const index = content.indexOf(search)
			if (index === -1) continue

			notFound = false

			if (replaceAll) {
				return content.replaceAll(search, newString)
			}

			const lastIndex = content.lastIndexOf(search)
			if (index !== lastIndex) continue

			return (
				content.substring(0, index) +
				newString +
				content.substring(index + search.length)
			)
		}
	}

	if (notFound) {
		throw new Error("oldString not found in content")
	}

	throw new Error(
		"Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match.",
	)
}

/**
 * Normalize line endings to Unix style
 */
function normalizeLineEndings(text: string): string {
	return text.replaceAll("\r\n", "\n")
}

// ============================================================================
// Tool Definition
// ============================================================================

const description = `Performs string replacements in files with fuzzy matching.

Usage:
- You must use your Read tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the oldString or newString.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if oldString is not found in the file with an error "oldString not found in content".
- The edit will FAIL if oldString is found multiple times in the file with an error "Found multiple matches for oldString". Either provide a larger string with more surrounding context to make it unique or use replaceAll to change every instance of oldString.
- Use replaceAll for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

Matching strategies (tried in order):
1. Exact match
2. Line-trimmed match (ignores leading/trailing whitespace per line)
3. Block anchor match (first/last line anchors with fuzzy middle)
4. Whitespace normalized match (collapses spaces/tabs)
5. Indentation flexible match (ignores indentation level)
6. Escape normalized match (handles \\n, \\t, etc.)
7. Trimmed boundary match
8. Context-aware match (uses surrounding lines)`

const inputSchema = z.object({
	filePath: z.string().describe("The absolute path to the file to modify"),
	oldString: z.string().describe("The text to replace"),
	newString: z
		.string()
		.describe("The text to replace it with (must be different from oldString)"),
	replaceAll: z
		.boolean()
		.optional()
		.describe("Replace all occurrences of oldString (default false)"),
})

const outputSchema = toolOutput({
	pending: {
		filePath: z.string(),
		result: z.undefined(),
	},
	success: {
		filePath: z.string(),
		result: z.string(),
		diff: z.string(),
	},
	error: {
		filePath: z.string(),
	},
})

/**
 * Create an edit tool with custom permission patterns.
 *
 * @param permissions - File path pattern to permission mapping, or a single
 * permission for all files. Patterns support wildcards (*) for matching. By
 * default requires approval for all edits.
 *
 * @example
 * // Allow editing all .ts files without approval
 * const tsEdit = createEditTool({ "*.ts": "allow", "*": "ask" })
 *
 * @example
 * // Require approval for everything (default)
 * const strictEdit = createEditTool({ "*": "ask" })
 *
 * @example
 * // Allow all edits without approval
 * const permissiveEdit = createEditTool("allow")
 */
export function createEditTool(
	permissions: Permission | Record<string, Permission> = "ask",
) {
	const permissionPatterns =
		typeof permissions === "string" ? { "*": permissions } : permissions

	return tool({
		description,
		inputSchema,
		outputSchema,
		needsApproval: ({ filePath }) => {
			const filepath = path.isAbsolute(filePath)
				? filePath
				: path.join(process.cwd(), filePath)

			const permission = checkPermission(filepath, permissionPatterns)

			if (permission === "deny") {
				throw new PermissionDeniedError("edit", filepath)
			}

			// Return true if approval needed (ask), false if auto-allowed
			return permission === "ask"
		},
		toModelOutput: (output) => {
			if (output.status === "error") {
				return {
					type: "error-text",
					value: `Error editing ${output.filePath}: ${output.error}`,
				}
			}
			if (output.status === "success") {
				return { type: "text", value: "" }
			}
			throw new Error("Invalid output status in toModelOutput")
		},
		async *execute({ filePath, oldString, newString, replaceAll = false }) {
			if (oldString === newString) {
				throw new Error("oldString and newString must be different")
			}

			const filepath = path.isAbsolute(filePath)
				? filePath
				: path.join(process.cwd(), filePath)

			yield {
				status: "pending",
				message: `Editing file: ${filepath}`,
				filePath: filepath,
				result: undefined,
			}

			try {
				try {
					await fs.access(filepath)
				} catch {
					throw new Error(`File ${filepath} not found`)
				}

				const stats = await fs.stat(filepath)
				if (stats.isDirectory()) {
					throw new Error(`Path is a directory, not a file: ${filepath}`)
				}

				const contentRaw = await fs.readFile(filepath, "utf-8")
				const content = normalizeLineEndings(contentRaw)

				// Handle empty oldString as creating/overwriting file
				if (oldString === "") {
					await fs.writeFile(filepath, newString, "utf-8")
					const diff = trimDiff(
						createTwoFilesPatch(filepath, filepath, content, newString),
					)
					yield {
						status: "success",
						message: `File created: ${filepath}`,
						filePath: filepath,
						result: `File created: ${filepath}`,
						diff,
					}
					return
				}

				// Use the replace function with all strategies
				const result = replace(content, oldString, newString, replaceAll)

				await fs.writeFile(filepath, result, "utf-8")

				const message = `File edited: ${filepath}`
				const diff = trimDiff(
					createTwoFilesPatch(filepath, filepath, content, result),
				)

				yield {
					status: "success",
					message,
					filePath: filepath,
					result: message,
					diff,
				}
			} catch (error) {
				yield {
					status: "error",
					message: `Failed to edit ${filepath}`,
					filePath: filepath,
					error: error instanceof Error ? error.message : String(error),
				}
			}
		},
	})
}

/**
 * Default edit tool with standard permissions.
 * All file edits require approval by default.
 */
export const editTool = createEditTool()
