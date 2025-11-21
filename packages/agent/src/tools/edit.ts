import { tool } from "ai"
import { createTwoFilesPatch } from "diff"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "./tool-utils"

export const editTool = tool({
	description: `Performs exact string replacements in files.

Usage:
- You must use your Read tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the oldString or newString.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if oldString is not found in the file with an error "oldString not found in content".
- The edit will FAIL if oldString is found multiple times in the file with an error "oldString found multiple times and requires more code context to uniquely identify the intended match". Either provide a larger string with more surrounding context to make it unique or use replaceAll to change every instance of oldString.
- Use replaceAll for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`,
	inputSchema: z.object({
		filePath: z.string().describe("The absolute path to the file to modify"),
		oldString: z.string().describe("The text to replace"),
		newString: z
			.string()
			.describe(
				"The text to replace it with (must be different from oldString)",
			),
		replaceAll: z
			.boolean()
			.optional()
			.describe("Replace all occurrences of oldString (default false)"),
	}),
	outputSchema: toolOutput({
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
	}),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return {
				type: "error-text",
				value: `Error editing ${output.filePath}: ${output.error}`,
			}
		}
		if (output.status === "success") {
			return {
				type: "text",
				value: `${output.result}\n\nChanges:\n${output.diff}`,
			}
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

			const content = await fs.readFile(filepath, "utf-8")

			// Handle empty oldString as creating a new file
			if (oldString === "") {
				await fs.writeFile(filepath, newString, "utf-8")
				const diff = createTwoFilesPatch(filepath, filepath, content, newString)
				yield {
					status: "success",
					message: `File created: ${filepath}`,
					filePath: filepath,
					result: `File created: ${filepath}`,
					diff,
				}
				return
			}

			// Try multiple replacement strategies
			const strategies = [
				// 1. Exact match
				() => {
					if (!content.includes(oldString)) return null
					const index = content.indexOf(oldString)
					const lastIndex = content.lastIndexOf(oldString)
					if (!replaceAll && index !== lastIndex) return null
					return replaceAll
						? content.replaceAll(oldString, newString)
						: content.substring(0, index) +
								newString +
								content.substring(index + oldString.length)
				},
				// 2. Line-trimmed match
				() => {
					const originalLines = content.split("\n")
					const searchLines = oldString
						.split("\n")
						.filter((line) => line !== "")

					for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
						let matches = true
						for (let j = 0; j < searchLines.length; j++) {
							if (originalLines[i + j]?.trim() !== searchLines[j]?.trim()) {
								matches = false
								break
							}
						}

						if (matches) {
							const matchStart =
								originalLines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0)
							const matchEnd =
								matchStart +
								originalLines.slice(i, i + searchLines.length).join("\n").length
							return (
								content.substring(0, matchStart) +
								newString +
								content.substring(matchEnd)
							)
						}
					}
					return null
				},
			]

			for (const strategy of strategies) {
				const result = strategy()
				if (result !== null) {
					await fs.writeFile(filepath, result, "utf-8")

					const message = `File edited: ${filepath}`
					const diff = createTwoFilesPatch(filepath, filepath, content, result)

					yield {
						status: "success",
						message,
						filePath: filepath,
						result: message,
						diff,
					}
					return
				}
			}

			if (!content.includes(oldString.trim())) {
				throw new Error("oldString not found in content")
			}

			throw new Error(
				"oldString found multiple times and requires more code context to uniquely identify the intended match",
			)
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
