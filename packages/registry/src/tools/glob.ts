import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import * as ripgrep from "@/tools/lib/ripgrep"
import { toolOutput } from "@/tools/lib/tool-output"

const LIMIT = 100

interface FileWithMtime {
	path: string
	mtime: number
}

/**
 * Find files using ripgrep
 */
async function globFiles(
	searchPath: string,
	pattern: string,
	limit: number,
): Promise<FileWithMtime[]> {
	const files: FileWithMtime[] = []

	for await (const file of ripgrep.files({
		cwd: searchPath,
		glob: [pattern],
	})) {
		const fullPath = path.resolve(searchPath, file)

		// Get modification time for sorting
		let mtime = 0
		try {
			const stats = await fs.stat(fullPath)
			mtime = stats.mtimeMs
		} catch {
			// File may have been deleted
		}

		files.push({ path: fullPath, mtime })
		if (files.length >= limit) break
	}

	return files
}

const description = `Searches for files matching a glob pattern.

Usage:
- Finds files by name pattern (e.g., "*.ts", "**/*.test.js")
- Returns full file paths sorted by modification time (most recent first)
- Results are limited to 100 files
- Respects .gitignore rules
- Supports full glob syntax: **, {a,b}, [abc]
- Useful for finding files by name or extension`

export const globTool = tool({
	description,
	inputSchema: z.object({
		pattern: z.string().describe("The glob pattern to match files against"),
		path: z
			.string()
			.optional()
			.describe(
				"The directory to search in. Defaults to the current working directory.",
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
			fileCount: z.number(),
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
			return { type: "text", value: output.result }
		}
		throw new Error("Invalid output status in toModelOutput")
	},
	async *execute({ pattern, path: searchPath = "." }) {
		const cwd = path.resolve(process.cwd(), searchPath)

		yield {
			status: "pending",
			message: `Searching for files matching: ${pattern}`,
			pattern,
			searchPath: cwd,
			result: undefined,
		}

		try {
			// Verify directory exists
			try {
				await fs.access(cwd)
			} catch {
				throw new Error(`Directory not found: ${cwd}`)
			}

			const files = await globFiles(cwd, pattern, LIMIT)

			// Sort by modification time (most recent first)
			files.sort((a, b) => b.mtime - a.mtime)

			const truncated = files.length >= LIMIT
			const output =
				files.length === 0
					? "No files found"
					: files.map((f) => f.path).join("\n")

			const result =
				output +
				(truncated
					? "\n\n(Results are truncated. Consider using a more specific path or pattern.)"
					: "")

			yield {
				status: "success",
				message: `Found ${files.length} files matching pattern: ${pattern}`,
				pattern,
				searchPath: cwd,
				result,
				fileCount: files.length,
			}
		} catch (error) {
			yield {
				status: "error",
				message: `Failed to search for ${pattern} in ${cwd}`,
				pattern,
				searchPath: cwd,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	},
})
