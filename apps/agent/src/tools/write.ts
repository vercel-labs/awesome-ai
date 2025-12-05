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

/**
 * Check if a path is contained within a directory
 */
function isPathWithin(directory: string, filepath: string): boolean {
	const relative = path.relative(directory, filepath)
	return !relative.startsWith("..") && !path.isAbsolute(relative)
}

const description = `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.
- Writing to paths outside the current working directory will include a warning.`

const inputSchema = z.object({
	filePath: z
		.string()
		.describe(
			"The absolute path to the file to write (must be absolute, not relative)",
		),
	content: z.string().describe("The content to write to the file"),
})

const outputSchema = toolOutput({
	pending: {
		filePath: z.string(),
		result: z.undefined(),
	},
	success: {
		filePath: z.string(),
		result: z.string(),
		content: z.string(),
		lineCount: z.number(),
		byteSize: z.number(),
		wasOverwrite: z.boolean(),
		diff: z.string().optional(),
		warning: z.string().optional(),
	},
	error: {
		filePath: z.string(),
	},
})

/**
 * Create a write tool with custom permission patterns.
 *
 * @param permissions - File path pattern to permission mapping, or a single permission for all files.
 *                     Patterns support wildcards (*) for matching.
 *                     Default requires approval for all writes.
 *
 * @example
 * // Allow writing all .ts files without approval
 * const tsWrite = createWriteTool({ "*.ts": "allow", "*": "ask" })
 *
 * @example
 * // Require approval for everything (default)
 * const strictWrite = createWriteTool({ "*": "ask" })
 *
 * @example
 * // Allow all writes without approval
 * const permissiveWrite = createWriteTool("allow")
 */
export function createWriteTool(
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
				throw new PermissionDeniedError("write", filepath)
			}

			// Return true if approval needed (ask), false if auto-allowed
			return permission === "ask"
		},
		toModelOutput: (output) => {
			if (output.status === "error") {
				return {
					type: "error-text",
					value: `Error writing ${output.filePath}: ${output.error}`,
				}
			}
			if (output.status === "success") {
				if (output.warning) {
					return { type: "text", value: `⚠️ ${output.warning}` }
				}
				// Only the UI needs the diff for display purposes
				return { type: "text", value: "" }
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
				// Check if writing outside working directory
				const cwd = process.cwd()
				let warning: string | undefined
				if (!isPathWithin(cwd, filepath)) {
					warning = `Writing file outside working directory: ${filepath}`
				}

				// Create directory if it doesn't exist
				const dir = path.dirname(filepath)
				await fs.mkdir(dir, { recursive: true })

				// Check if file exists and get its content for diff
				let exists = false
				let previousContent = ""
				try {
					await fs.access(filepath)
					exists = true
					previousContent = await fs.readFile(filepath, "utf-8")
				} catch {
					// File doesn't exist
				}

				// Write the file
				await fs.writeFile(filepath, content, "utf-8")

				// Calculate stats
				const lineCount = content.split("\n").length
				const byteSize = Buffer.byteLength(content, "utf-8")

				// Generate diff if overwriting
				let diff: string | undefined
				if (exists && previousContent !== content) {
					diff = trimDiff(
						createTwoFilesPatch(filepath, filepath, previousContent, content),
					)
				}

				const action = exists ? "overwritten" : "created"
				const message = `File ${action}: ${filepath} (${lineCount} lines, ${byteSize} bytes)`

				yield {
					status: "success",
					message,
					filePath: filepath,
					result: message,
					content,
					lineCount,
					byteSize,
					wasOverwrite: exists,
					diff,
					warning,
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
}

/**
 * Default write tool with standard permissions.
 * All file writes require approval by default.
 */
export const writeTool = createWriteTool()
