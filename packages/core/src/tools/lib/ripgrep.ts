import { type ChildProcess, spawn } from "child_process"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

const RIPGREP_VERSION = "14.1.1"

const PLATFORM: Record<string, { name: string; ext: "tar.gz" | "zip" }> = {
	"arm64-darwin": { name: "aarch64-apple-darwin", ext: "tar.gz" },
	"arm64-linux": { name: "aarch64-unknown-linux-gnu", ext: "tar.gz" },
	"x64-darwin": { name: "x86_64-apple-darwin", ext: "tar.gz" },
	"x64-linux": { name: "x86_64-unknown-linux-musl", ext: "tar.gz" },
	"x64-win32": { name: "x86_64-pc-windows-msvc", ext: "zip" },
}

function getBinDir(): string {
	return path.join(os.homedir(), ".cache", "awesome-ai", "bin")
}

let cachedRgPath: string | undefined

async function which(bin: string): Promise<string | undefined> {
	const pathValue = process.env.PATH ?? ""
	const exts =
		process.platform === "win32"
			? (process.env.PATHEXT?.split(";").filter(Boolean) ?? [
					".EXE",
					".CMD",
					".BAT",
				])
			: [""]

	for (const dir of pathValue.split(path.delimiter)) {
		if (!dir) continue
		for (const ext of exts) {
			const full = path.join(
				dir,
				process.platform === "win32" ? `${bin}${ext}` : bin,
			)
			try {
				await fs.access(full, fs.constants.X_OK)
				return full
			} catch {
				// keep searching
			}
		}
	}

	return undefined
}

/**
 * Get the path to the ripgrep binary.
 * Checks for system ripgrep first, then downloads from GitHub if needed.
 */
export async function getRipgrepPath(): Promise<string> {
	if (cachedRgPath) return cachedRgPath

	// 1. Check for system ripgrep
	const systemRg = await which("rg")
	if (systemRg) {
		cachedRgPath = systemRg
		return systemRg
	}

	// 2. Check if already downloaded
	const binDir = getBinDir()
	const rgPath = path.join(
		binDir,
		process.platform === "win32" ? "rg.exe" : "rg",
	)

	try {
		await fs.access(rgPath, fs.constants.X_OK)
		cachedRgPath = rgPath
		return rgPath
	} catch {
		// Not downloaded yet
	}

	// 3. Download from GitHub
	await downloadRipgrep(binDir, rgPath)
	cachedRgPath = rgPath
	return rgPath
}

async function downloadRipgrep(binDir: string, rgPath: string): Promise<void> {
	const platformKey = `${process.arch}-${process.platform}`
	const config = PLATFORM[platformKey]
	if (!config) throw new Error(`Unsupported platform: ${platformKey}`)

	const filename = `ripgrep-${RIPGREP_VERSION}-${config.name}.${config.ext}`
	const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${filename}`

	await fs.mkdir(binDir, { recursive: true })
	const archivePath = path.join(binDir, filename)

	// Download
	const response = await fetch(url)
	if (!response.ok)
		throw new Error(`Failed to download ripgrep: ${response.status}`)
	await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()))

	// Extract
	if (config.ext === "tar.gz") {
		await extractTarGz(archivePath, binDir, platformKey)
	} else {
		await extractZip(archivePath, rgPath)
	}

	// Cleanup & permissions
	await fs.unlink(archivePath)
	if (process.platform !== "win32") {
		await fs.chmod(rgPath, 0o755)
	}
}

async function extractTarGz(
	archivePath: string,
	binDir: string,
	platformKey: string,
): Promise<void> {
	const args = ["tar", "-xzf", archivePath, "--strip-components=1"]

	// Platform-specific flags to extract only the rg binary
	if (platformKey.endsWith("-darwin")) {
		args.push("--include=*/rg")
	} else if (platformKey.endsWith("-linux")) {
		args.push("--wildcards", "*/rg")
	}

	await new Promise<void>((resolve, reject) => {
		const proc = spawn(args[0]!, args.slice(1), {
			cwd: binDir,
			stdio: ["ignore", "pipe", "pipe"],
		})

		let stderr = ""
		proc.stderr?.on("data", (chunk) => {
			stderr += chunk.toString()
		})

		proc.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`tar extraction failed: ${stderr}`))
			} else {
				resolve()
			}
		})

		proc.on("error", reject)
	})
}

async function extractZip(archivePath: string, rgPath: string): Promise<void> {
	// Dynamic import to avoid loading unzipper on non-Windows platforms
	const unzipper = (await import("unzipper")) as typeof import("unzipper")

	const directory = await unzipper.Open.file(archivePath)
	const rgEntry = directory.files.find((f: { path: string }) =>
		f.path.endsWith("rg.exe"),
	)

	if (!rgEntry) {
		throw new Error("rg.exe not found in zip archive")
	}

	const content = await rgEntry.buffer()
	await fs.writeFile(rgPath, content)
}

export interface FilesOptions {
	cwd: string
	glob?: string[]
}

/**
 * Async generator that yields file paths using ripgrep.
 * Uses `rg --files` which is much faster than manual directory walking.
 *
 * @param opts.cwd - Directory to search in
 * @param opts.glob - Glob patterns (prefix with ! to exclude)
 * @yields File paths relative to cwd
 */
export async function* files(opts: FilesOptions): AsyncGenerator<string> {
	const rgPath = await getRipgrepPath()

	const args = [
		"--files",
		"--follow", // Follow symlinks
		"--hidden", // Include hidden files
		"--glob=!.git/*", // Always exclude .git
	]

	// Add custom glob patterns
	if (opts.glob) {
		for (const g of opts.glob) {
			args.push(`--glob=${g}`)
		}
	}

	const proc = spawn(rgPath, args, {
		cwd: opts.cwd,
		stdio: ["ignore", "pipe", "ignore"],
	})

	yield* streamLines(proc)
}

export interface SearchOptions {
	cwd: string
	pattern: string
	glob?: string[]
	maxCount?: number
}

export interface SearchMatch {
	path: string
	lineNumber: number
	lineText: string
}

/**
 * Search for a pattern in files using ripgrep.
 *
 * @param opts.cwd - Directory to search in
 * @param opts.pattern - Regex pattern to search for
 * @param opts.glob - Glob patterns to filter files
 * @param opts.maxCount - Maximum matches per file
 * @yields Search matches with file path, line number, and text
 */
export async function* search(
	opts: SearchOptions,
): AsyncGenerator<SearchMatch> {
	const rgPath = await getRipgrepPath()

	const args = [
		"--json", // Stable parsing across platforms and paths
		"--hidden", // Include hidden files
		"--glob=!.git/*", // Always exclude .git
	]

	// Add custom glob patterns
	if (opts.glob) {
		for (const g of opts.glob) {
			args.push(`--glob=${g}`)
		}
	}

	if (opts.maxCount) {
		args.push(`--max-count=${opts.maxCount}`)
	}

	args.push("--", opts.pattern)

	const proc = spawn(rgPath, args, {
		cwd: opts.cwd,
		stdio: ["ignore", "pipe", "ignore"],
	})

	for await (const line of streamLines(proc)) {
		const parsed = JSON.parse(line) as {
			type?: string
			data?: {
				path?: { text?: string }
				lines?: { text?: string }
				line_number?: number
			}
		}
		if (parsed.type !== "match") continue
		const file = parsed.data?.path?.text
		const text = parsed.data?.lines?.text
		const lineNumber = parsed.data?.line_number
		if (!file || text === undefined || !lineNumber) continue
		yield {
			path: file,
			lineNumber,
			lineText: text.replace(/\r?\n$/, ""),
		}
	}
}

/**
 * Stream lines from a child process stdout
 */
async function* streamLines(proc: ChildProcess): AsyncGenerator<string> {
	const stdout = proc.stdout
	if (!stdout) return

	// Set up close handler BEFORE consuming stdout to avoid race condition
	const closePromise = new Promise<void>((resolve) => {
		proc.once("close", () => resolve())
	})

	let buffer = ""

	for await (const chunk of stdout) {
		buffer += chunk.toString()
		const lines = buffer.split("\n")
		buffer = lines.pop() || ""

		for (const line of lines) {
			if (line) yield line
		}
	}

	// Yield any remaining content
	if (buffer) yield buffer

	// Wait for process to exit
	await closePromise
}
