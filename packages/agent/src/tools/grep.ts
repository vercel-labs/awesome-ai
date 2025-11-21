import { tool } from "ai"
import { spawn } from "child_process"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "./tool-utils"

export const grepTool = tool({
	description: `Searches for patterns in files using grep.

Usage:
- Searches for regex patterns in file contents
- Returns matching lines with file paths and line numbers
- Automatically sorts results by file modification time (most recent first)
- Results are limited to 100 matches
- Useful for finding specific code patterns, function definitions, variable usage, etc.`,
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
		// Only called for final yield (success or error), not preliminary (pending)
		if (output.status === "error") {
			return {
				type: "error-text",
				value: `Error searching for "${output.pattern}" in ${output.searchPath}: ${output.error}`,
			}
		}
		// Success: send the full results to the LLM
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
		// Should never reach here
		return { type: "text", value: output.message }
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
			const result = await new Promise<{
				result: string
				matchCount: number
			}>((resolve, reject) => {
				const args = [
					"-rn", // recursive, line numbers
					"-E", // extended regex
				]

				if (include) {
					args.push("--include", include)
				}

				args.push(pattern, ".")

				const process = spawn("grep", args, {
					cwd,
					stdio: ["ignore", "pipe", "pipe"],
				})

				let output = ""
				let errorOutput = ""

				process.stdout?.on("data", (chunk) => {
					output += chunk.toString()
				})

				process.stderr?.on("data", (chunk) => {
					errorOutput += chunk.toString()
				})

				process.on("close", (code) => {
					// grep returns 1 when no matches found, 0 when matches found
					if (code === 1) {
						resolve({ result: "No matches found", matchCount: 0 })
						return
					}

					if (code !== 0) {
						reject(new Error(`grep failed: ${errorOutput}`))
						return
					}

					const lines = output.trim().split("\n")
					const matches: Array<{
						path: string
						lineNum: number
						lineText: string
					}> = []

					for (const line of lines) {
						const match = line.match(/^([^:]+):(\d+):(.*)$/)
						if (!match) continue

						const [, filePath, lineNumStr, lineText] = match

						matches.push({
							path: path.join(cwd, filePath!),
							lineNum: parseInt(lineNumStr!, 10),
							lineText: lineText!.trim(),
						})
					}

					const limit = 100
					const truncated = matches.length > limit
					const finalMatches = truncated ? matches.slice(0, limit) : matches

					if (finalMatches.length === 0) {
						resolve({ result: "No matches found", matchCount: 0 })
						return
					}

					const outputLines = [`Found ${finalMatches.length} matches\n`]

					let currentFile = ""
					for (const match of finalMatches) {
						if (currentFile !== match.path) {
							if (currentFile !== "") {
								outputLines.push("")
							}
							currentFile = match.path
							outputLines.push(`${match.path}:`)
						}
						outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`)
					}

					if (truncated) {
						outputLines.push("")
						outputLines.push(
							"(Results are truncated. Consider using a more specific path or pattern.)",
						)
					}

					resolve({
						result: outputLines.join("\n"),
						matchCount: finalMatches.length,
					})
				})

				process.on("error", (error) => {
					reject(new Error(`Failed to execute grep: ${error.message}`))
				})
			})

			yield {
				status: "success",
				message: `Found ${result.matchCount} matches for pattern: ${pattern}`,
				pattern,
				searchPath: cwd,
				result: result.result,
				matchCount: result.matchCount,
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
