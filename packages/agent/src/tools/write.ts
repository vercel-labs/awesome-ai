import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "./tool-utils"

export const writeTool = tool({
	description: `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`,
	inputSchema: z.object({
		filePath: z
			.string()
			.describe(
				"The absolute path to the file to write (must be absolute, not relative)",
			),
		content: z.string().describe("The content to write to the file"),
	}),
	outputSchema: toolOutput({
		pending: {
			filePath: z.string(),
			result: z.undefined(),
		},
		success: {
			filePath: z.string(),
			result: z.string(),
			content: z.string(),
		},
		error: {
			filePath: z.string(),
		},
	}),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return {
				type: "error-text",
				value: `Error writing ${output.filePath}: ${output.error}`,
			}
		}
		if (output.status === "success") {
			return { type: "text", value: output.result }
		}
		throw new Error("Invalid output status in toModelOutput")
	},
	async *execute({ filePath, content }) {
		const filepath = path.isAbsolute(filePath)
			? filePath
			: path.join(process.cwd(), filePath)

		yield {
			status: "pending",
			message: `Writing file: ${filepath}`,
			filePath: filepath,
			result: undefined,
		}

		try {
			// Create directory if it doesn't exist
			const dir = path.dirname(filepath)
			await fs.mkdir(dir, { recursive: true })

			let exists = false
			try {
				await fs.access(filepath)
				exists = true
			} catch {
				// File doesn't exist
			}

			await fs.writeFile(filepath, content, "utf-8")

			const message = exists
				? `File overwritten: ${filepath}`
				: `File created: ${filepath}`

			yield {
				status: "success",
				message,
				filePath: filepath,
				result: message,
				content,
			}
		} catch (error) {
			yield {
				status: "error",
				message: `Failed to write ${filepath}`,
				filePath: filepath,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	},
})
