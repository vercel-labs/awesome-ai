import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "./tool-utils"

const MAX_LINE_LENGTH = 2000

export const readTool = tool({
	description: `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The filePath parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than 2000 characters will be truncated
- Results are returned using cat -n format, with line numbers starting at 1
- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.`,
	inputSchema: z.object({
		filePath: z.string().describe("The path to the file to read"),
		offset: z
			.number()
			.default(0)
			.describe("The line number to start reading from (0-based)"),
		limit: z
			.number()
			.default(2000)
			.describe("The number of lines to read (defaults to 2000)"),
	}),
	outputSchema: toolOutput({
		pending: {
			filePath: z.string(),
			content: z.undefined(),
		},
		success: {
			filePath: z.string(),
			content: z.string(),
			linesRead: z.number(),
			totalLines: z.number(),
		},
		error: {
			filePath: z.string(),
		},
	}),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return {
				type: "error-text",
				value: `Error reading ${output.filePath}: ${output.error}`,
			}
		}
		if (output.status === "success") {
			return { type: "text", value: output.content }
		}
		throw new Error("Invalid output status in toModelOutput")
	},
	async *execute({ filePath, offset, limit }) {
		let filepath = filePath
		if (!path.isAbsolute(filepath)) {
			filepath = path.join(process.cwd(), filepath)
		}

		yield {
			status: "pending",
			message: `Reading file: ${filepath}`,
			filePath: filepath,
			content: undefined,
		}

		try {
			try {
				await fs.access(filepath)
			} catch {
				const dir = path.dirname(filepath)
				const base = path.basename(filepath)

				try {
					const dirEntries = await fs.readdir(dir)
					const suggestions = dirEntries
						.filter(
							(entry) =>
								entry.toLowerCase().includes(base.toLowerCase()) ||
								base.toLowerCase().includes(entry.toLowerCase()),
						)
						.map((entry) => path.join(dir, entry))
						.slice(0, 3)

					if (suggestions.length > 0) {
						throw new Error(
							`File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`,
						)
					}
				} catch {
					// Directory doesn't exist or can't be read
				}

				throw new Error(`File not found: ${filepath}`)
			}

			const stats = await fs.stat(filepath)
			if (stats.isDirectory()) {
				throw new Error(`Path is a directory, not a file: ${filepath}`)
			}

			// Check if file is binary
			const fileHandle = await fs.open(filepath, "r")
			const buffer = Buffer.alloc(8000)
			const { bytesRead } = await fileHandle.read(buffer, 0, 8000, 0)
			await fileHandle.close()

			if (bytesRead > 0) {
				const slice = buffer.slice(0, Math.min(bytesRead, 8000))
				// Check for null bytes or high percentage of non-printable characters
				let nonPrintableCount = 0
				for (let i = 0; i < slice.length; i++) {
					const byte = slice[i]
					if (byte === undefined) continue
					if (byte === 0) {
						throw new Error(`Cannot read binary file: ${filepath}`)
					}
					if (byte < 9 || (byte > 13 && byte < 32)) {
						nonPrintableCount++
					}
				}
				if (nonPrintableCount / slice.length > 0.3) {
					throw new Error(`Cannot read binary file: ${filepath}`)
				}
			}

			const content = await fs.readFile(filepath, "utf-8")
			const lines = content.split("\n")
			const raw = lines.slice(offset, offset + limit).map((line) => {
				return line.length > MAX_LINE_LENGTH
					? `${line.substring(0, MAX_LINE_LENGTH)}...`
					: line
			})

			const formattedLines = raw.map((line, index) => {
				return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
			})

			let output = "<file>\n"
			output += formattedLines.join("\n")

			if (lines.length > offset + formattedLines.length) {
				output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${offset + formattedLines.length})`
			}
			output += "\n</file>"

			yield {
				status: "success",
				message: `Successfully read ${formattedLines.length} lines from ${filepath}`,
				filePath: filepath,
				content: output,
				linesRead: formattedLines.length,
				totalLines: lines.length,
			}
		} catch (error) {
			yield {
				status: "error",
				message: `Failed to read ${filepath}`,
				filePath: filepath,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	},
})
