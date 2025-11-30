import { tool } from "ai"
import { promises as fs } from "fs"
import * as path from "path"
import { z } from "zod"
import * as ripgrep from "@/tools/lib/ripgrep"
import { toolOutput } from "@/tools/lib/tool-output"

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

/**
 * List files using ripgrep
 */
async function listFiles(
	searchPath: string,
	ignorePatterns: string[],
	limit: number,
): Promise<string[]> {
	// Convert ignore patterns to ripgrep glob format
	// Handles patterns that already start with `!` to avoid double negation
	const globs = ignorePatterns.map((p) => (p.startsWith("!") ? p : `!${p}/*`))

	const files: string[] = []
	for await (const file of ripgrep.files({ cwd: searchPath, glob: globs })) {
		files.push(file)
		if (files.length >= limit) break
	}

	return files
}

/**
 * Build a tree-style directory structure from file paths
 */
function buildTree(files: string[], rootPath: string): string {
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

	return `${rootPath}/\n${renderDir(".", 0)}`
}

const description = `Lists files and directories in a given path.

Usage:
- Lists files in a directory recursively
- Uses ripgrep for fast file listing
- Automatically ignores common build and dependency directories
- Respects .gitignore rules
- Results are limited to 100 files
- Displays directory structure in a tree format`

export const listTool = tool({
	description,
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
			.describe(
				"Additional patterns to ignore. Can be directory names (e.g., 'logs') or full glob patterns (e.g., '!*.tmp')",
			),
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
			// Verify directory exists
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
			const files = await listFiles(resolvedPath, allIgnorePatterns, LIMIT)

			const output = buildTree(files, resolvedPath)
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
