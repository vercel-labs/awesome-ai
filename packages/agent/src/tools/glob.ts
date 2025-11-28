import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "@/tools/lib/tool-output"

export const globTool = tool({
	description: `Searches for files matching a glob pattern.

Usage:
- Finds files by name pattern (e.g., "*.ts", "**/*.test.js")
- Returns full file paths sorted by modification time (most recent first)
- Results are limited to 100 files
- Useful for finding files by name or extension`,
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
			try {
				await fs.access(cwd)
			} catch {
				throw new Error(`Directory not found: ${cwd}`)
			}

			// Simple glob matching function
			function matchGlob(filePath: string, pattern: string): boolean {
				// Convert glob pattern to regex
				const regexPattern = pattern
					.replace(/\./g, "\\.")
					.replace(/\*/g, ".*")
					.replace(/\?/g, ".")
				const regex = new RegExp(`^${regexPattern}$`)
				return regex.test(filePath)
			}

			const files: Array<{ path: string; mtime: number }> = []
			const limit = 100

			async function walk(dir: string) {
				if (files.length >= limit) return

				try {
					const entries = await fs.readdir(dir, { withFileTypes: true })

					for (const entry of entries) {
						const fullPath = path.join(dir, entry.name)
						const relativePath = path.relative(cwd, fullPath)

						// Skip common ignored directories
						if (
							entry.isDirectory() &&
							["node_modules", ".git", "dist", "build"].includes(entry.name)
						) {
							continue
						}

						if (entry.isDirectory()) {
							await walk(fullPath)
						} else if (
							matchGlob(relativePath, pattern) ||
							matchGlob(entry.name, pattern)
						) {
							const stats = await fs.stat(fullPath)
							files.push({
								path: fullPath,
								mtime: stats.mtimeMs,
							})
							if (files.length >= limit) break
						}
					}
				} catch (_error) {
					// Skip directories we can't read
				}
			}

			await walk(cwd)

			// Sort by modification time (most recent first)
			files.sort((a, b) => b.mtime - a.mtime)

			const truncated = files.length >= limit
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
