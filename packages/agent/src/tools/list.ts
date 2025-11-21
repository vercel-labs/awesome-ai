import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import { toolOutput } from "./tool-utils"

const IGNORE_PATTERNS = [
	"node_modules",
	"__pycache__",
	".git",
	"dist",
	"build",
	"target",
	"vendor",
	"bin",
	"obj",
	".idea",
	".vscode",
	".zig-cache",
	"zig-out",
	".coverage",
	"coverage",
	"tmp",
	"temp",
	".cache",
	"cache",
	"logs",
	".venv",
	"venv",
	"env",
]

const LIMIT = 100

export const listTool = tool({
	description: `Lists files and directories in a given path.

Usage:
- Lists files in a directory recursively
- Automatically ignores common build and dependency directories
- Results are limited to 100 files
- Displays directory structure in a tree format`,
	inputSchema: z.object({
		path: z
			.string()
			.optional()
			.describe(
				"The path to the directory to list (defaults to current directory)",
			),
		ignore: z
			.array(z.string())
			.optional()
			.describe("Additional glob patterns to ignore"),
	}),
	outputSchema: toolOutput({
		pending: {
			dirPath: z.string(),
			result: z.undefined(),
		},
		success: {
			dirPath: z.string(),
			result: z.string(),
			fileCount: z.number(),
		},
		error: {
			dirPath: z.string(),
		},
	}),
	toModelOutput: (output) => {
		if (output.status === "error") {
			return {
				type: "error-text",
				value: `Error listing ${output.dirPath}: ${output.error}`,
			}
		}
		if (output.status === "success") {
			return { type: "text", value: output.result }
		}
		throw new Error("Invalid output status in toModelOutput")
	},
	async *execute({ path: searchPath = ".", ignore = [] }) {
		const resolvedPath = path.resolve(process.cwd(), searchPath)

		yield {
			status: "pending",
			message: `Listing directory: ${resolvedPath}`,
			dirPath: resolvedPath,
			result: undefined,
		}

		try {
			try {
				await fs.access(resolvedPath)
			} catch {
				throw new Error(`Directory not found: ${resolvedPath}`)
			}

			const stats = await fs.stat(resolvedPath)
			if (!stats.isDirectory()) {
				throw new Error(`Path is not a directory: ${resolvedPath}`)
			}

			const allIgnorePatterns = [...IGNORE_PATTERNS, ...ignore]

			function shouldIgnore(filePath: string): boolean {
				const parts = filePath.split(path.sep)
				return parts.some((part) => allIgnorePatterns.includes(part))
			}

			const files: string[] = []

			async function walk(dir: string, depth = 0) {
				if (files.length >= LIMIT) return

				try {
					const entries = await fs.readdir(dir, { withFileTypes: true })

					for (const entry of entries) {
						const fullPath = path.join(dir, entry.name)
						const relativePath = path.relative(resolvedPath, fullPath)

						if (shouldIgnore(relativePath)) continue

						if (entry.isDirectory()) {
							await walk(fullPath, depth + 1)
						} else {
							files.push(relativePath)
							if (files.length >= LIMIT) break
						}
					}
				} catch (_error) {
					// Skip directories we can't read
				}
			}

			await walk(resolvedPath)

			// Build directory structure
			const dirs = new Set<string>()
			const filesByDir = new Map<string, string[]>()

			for (const file of files) {
				const dir = path.dirname(file)
				const parts = dir === "." ? [] : dir.split(path.sep)

				// Add all parent directories
				for (let i = 0; i <= parts.length; i++) {
					const dirPath = i === 0 ? "." : parts.slice(0, i).join(path.sep)
					dirs.add(dirPath)
				}

				// Add file to its directory
				if (!filesByDir.has(dir)) filesByDir.set(dir, [])
				filesByDir.get(dir)!.push(path.basename(file))
			}

			function renderDir(dirPath: string, depth: number): string {
				const indent = "  ".repeat(depth)
				let output = ""

				if (depth > 0) {
					output += `${indent}${path.basename(dirPath)}/\n`
				}

				const childIndent = "  ".repeat(depth + 1)
				const children = Array.from(dirs)
					.filter((d) => path.dirname(d) === dirPath && d !== dirPath)
					.sort()

				// Render subdirectories first
				for (const child of children) {
					output += renderDir(child, depth + 1)
				}

				// Render files
				const dirFiles = filesByDir.get(dirPath) || []
				for (const file of dirFiles.sort()) {
					output += `${childIndent}${file}\n`
				}

				return output
			}

			const output = `${resolvedPath}/\n${renderDir(".", 0)}`
			const truncated = files.length >= LIMIT
			const result =
				output + (truncated ? "\n(Results truncated to 100 files)" : "")

			yield {
				status: "success",
				message: `Found ${files.length} files in ${resolvedPath}`,
				dirPath: resolvedPath,
				result,
				fileCount: files.length,
			}
		} catch (error) {
			yield {
				status: "error",
				message: `Failed to list ${resolvedPath}`,
				dirPath: resolvedPath,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	},
})
