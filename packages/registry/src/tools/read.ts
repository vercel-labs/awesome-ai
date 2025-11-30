import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "@/tools/lib/tool-output"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000

/**
 * Known binary file extensions - skip byte analysis for these
 */
const BINARY_EXTENSIONS = new Set([
	// Archives
	".zip",
	".tar",
	".gz",
	".7z",
	".rar",
	".bz2",
	".xz",
	// Executables
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	// Java
	".class",
	".jar",
	".war",
	// Documents
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	".pdf",
	".odt",
	".ods",
	".odp",
	// Images
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".webp",
	".ico",
	".svg",
	// Audio/Video
	".mp3",
	".mp4",
	".wav",
	".avi",
	".mkv",
	".mov",
	// Compiled/Object files
	".o",
	".obj",
	".a",
	".lib",
	".wasm",
	".pyc",
	".pyo",
	// Data
	".dat",
	".db",
	".sqlite",
	".sqlite3",
])

/**
 * Sensitive file patterns that should be blocked
 */
function isSensitiveFile(filepath: string): boolean {
	const basename = path.basename(filepath)

	// Whitelist: allow example/sample env files
	const whitelist = [
		".env.sample",
		".env.example",
		".env.template",
		".env.local.example",
	]
	if (whitelist.some((w) => basename.endsWith(w) || basename === w.slice(1))) {
		return false
	}

	// Block .env files
	if (basename.includes(".env")) {
		return true
	}

	return false
}

/**
 * Check if a path is contained within a directory
 */
function isPathWithin(directory: string, filepath: string): boolean {
	const relative = path.relative(directory, filepath)
	return !relative.startsWith("..") && !path.isAbsolute(relative)
}

/**
 * Check if file is binary using extension fast-path and byte analysis
 */
async function isBinaryFile(filepath: string): Promise<boolean> {
	const ext = path.extname(filepath).toLowerCase()

	// Fast-path: known binary extensions
	if (BINARY_EXTENSIONS.has(ext)) {
		return true
	}

	// Byte analysis for unknown extensions
	const fileHandle = await fs.open(filepath, "r")
	try {
		const buffer = Buffer.alloc(4096)
		const { bytesRead } = await fileHandle.read(buffer, 0, 4096, 0)

		if (bytesRead === 0) return false

		const slice = buffer.slice(0, bytesRead)
		let nonPrintableCount = 0

		for (let i = 0; i < slice.length; i++) {
			const byte = slice[i]
			if (byte === undefined) continue

			// Null byte = definitely binary
			if (byte === 0) {
				return true
			}

			// Count non-printable characters (excluding common whitespace)
			if (byte < 9 || (byte > 13 && byte < 32)) {
				nonPrintableCount++
			}
		}

		// >30% non-printable = binary
		return nonPrintableCount / slice.length > 0.3
	} finally {
		await fileHandle.close()
	}
}

const description = `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The filePath parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than 2000 characters will be truncated
- Results are returned using cat -n format, with line numbers starting at 1
- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.
- Sensitive files like .env are blocked for security (but .env.example, .env.sample are allowed).
- Binary files cannot be read and will return an error.`

export const readTool = tool({
	description,
	inputSchema: z.object({
		filePath: z.string().describe("The path to the file to read"),
		offset: z
			.number()
			.default(0)
			.describe("The line number to start reading from (0-based)"),
		limit: z
			.number()
			.default(DEFAULT_READ_LIMIT)
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
			warning: z.string().optional(),
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
			let result = output.content

			// Add warning if present
			if (output.warning) {
				result = `⚠️ ${output.warning}\n\n${result}`
			}

			return { type: "text", value: result }
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
			// Check for sensitive files
			if (isSensitiveFile(filepath)) {
				throw new Error(
					`Cannot read sensitive file: ${filepath}\nFor security, .env files are blocked. Use .env.example or .env.sample instead.`,
				)
			}

			// Check if reading outside working directory
			const cwd = process.cwd()
			let warning: string | undefined
			if (!isPathWithin(cwd, filepath)) {
				warning = `Reading file outside working directory: ${filepath}`
			}

			// Check if file exists
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
				} catch (e) {
					// Directory doesn't exist or can't be read - rethrow if it's our suggestion error
					if (e instanceof Error && e.message.includes("Did you mean")) {
						throw e
					}
				}

				throw new Error(`File not found: ${filepath}`)
			}

			// Check if it's a directory
			const stats = await fs.stat(filepath)
			if (stats.isDirectory()) {
				throw new Error(`Path is a directory, not a file: ${filepath}`)
			}

			// Check if file is binary
			if (await isBinaryFile(filepath)) {
				throw new Error(`Cannot read binary file: ${filepath}`)
			}

			// Read and process the file
			const content = await fs.readFile(filepath, "utf-8")
			const lines = content.split("\n")
			const totalLines = lines.length

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

			const lastReadLine = offset + formattedLines.length
			const hasMoreLines = totalLines > lastReadLine

			if (hasMoreLines) {
				output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`
			} else {
				output += `\n\n(End of file - total ${totalLines} lines)`
			}
			output += "\n</file>"

			yield {
				status: "success",
				message: `Successfully read ${formattedLines.length} lines from ${filepath}`,
				filePath: filepath,
				content: output,
				linesRead: formattedLines.length,
				totalLines,
				warning,
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
