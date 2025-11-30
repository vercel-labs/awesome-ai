import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import * as ripgrep from "@/tools/lib/ripgrep"
import { toolOutput } from "@/tools/lib/tool-output"

const LIMIT = 100

interface Match {
	path: string
	lineNum: number
	lineText: string
	modTime: number
}

/**
 * Search using ripgrep
 */
async function searchFiles(
	searchPath: string,
	pattern: string,
	include?: string,
): Promise<Match[]> {
	const glob = include ? [include] : undefined

	const matches: Match[] = []

	for await (const match of ripgrep.search({
		cwd: searchPath,
		pattern,
		glob,
	})) {
		const fullPath = path.join(searchPath, match.path)

		// Get file modification time for sorting
		let modTime = 0
		try {
			const stats = await fs.stat(fullPath)
			modTime = stats.mtimeMs
		} catch {
			// File may have been deleted
		}

		matches.push({
			path: fullPath,
			lineNum: match.lineNumber,
			lineText: match.lineText.trim(),
			modTime,
		})

		if (matches.length >= LIMIT) break
	}

	return matches
}

/**
 * Format matches for output
 */
function formatMatches(matches: Match[]): string {
	if (matches.length === 0) {
		return "No matches found"
	}

	// Sort by modification time (most recent first)
	matches.sort((a, b) => b.modTime - a.modTime)

	const outputLines = [`Found ${matches.length} matches\n`]

	let currentFile = ""
	for (const match of matches) {
		if (currentFile !== match.path) {
			if (currentFile !== "") {
				outputLines.push("")
			}
			currentFile = match.path
			outputLines.push(`${match.path}:`)
		}
		outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`)
	}

	if (matches.length >= LIMIT) {
		outputLines.push("")
		outputLines.push(
			"(Results are truncated. Consider using a more specific path or pattern.)",
		)
	}

	return outputLines.join("\n")
}

const description = `Searches for patterns in files using ripgrep.

Usage:
- Searches for regex patterns in file contents
- Returns matching lines with file paths and line numbers
- Results are sorted by file modification time (most recent first)
- Results are limited to 100 matches
- Respects .gitignore rules
- Useful for finding specific code patterns, function definitions, variable usage, etc.`

export const grepTool = tool({
	description,
	inputSchema: z.object({
		pattern: z
			.string()
			.describe("The regex pattern to search for in file contents"),
		path: z
			.string()
			.optional()
			.describe(
				"The directory to search in. Defaults to the current working directory.",
			),
		include: z
			.string()
			.optional()
			.describe(
				'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
			),
	}),
	outputSchema: toolOutput({
		pending: {
			pattern: z.string(),
			searchPath: z.string(),
			result: z.undefined(),
		},
		success: {
			pattern: z.string(),
			searchPath: z.string(),
			result: z.string(),
			matchCount: z.number(),
		},
		error: {
			pattern: z.string(),
			searchPath: z.string(),
		},
	}),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return {
				type: "error-text",
				value: `Error searching for "${output.pattern}" in ${output.searchPath}: ${output.error}`,
			}
		}
		if (output.status === "success") {
			if (output.matchCount === 0) {
				return {
					type: "text",
					value: `No matches found for pattern "${output.pattern}"`,
				}
			}
			return {
				type: "text",
				value: `Found ${output.matchCount} matches for "${output.pattern}":\n${output.result}`,
			}
		}
		throw new Error("Invalid output status in toModelOutput")
	},
	async *execute({ pattern, path: searchPath, include }) {
		const cwd = searchPath || process.cwd()

		yield {
			status: "pending",
			message: `Searching for pattern: ${pattern}`,
			pattern,
			searchPath: cwd,
			result: undefined,
		}

		try {
			const matches = await searchFiles(cwd, pattern, include)
			const result = formatMatches(matches)

			yield {
				status: "success",
				message: `Found ${matches.length} matches for pattern: ${pattern}`,
				pattern,
				searchPath: cwd,
				result,
				matchCount: matches.length,
			}
		} catch (error) {
			yield {
				status: "error",
				message: `Failed to search for pattern: ${pattern}`,
				pattern,
				searchPath: cwd,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	},
})
