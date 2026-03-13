import { tool } from "ai"
import { spawn } from "child_process"
import { promises as fs } from "fs"
import { createRequire } from "module"
import * as path from "path"
import { z } from "zod"
import type { Parser as TsParser } from "web-tree-sitter"
import {
	checkPermission,
	type Permission,
	PermissionDeniedError,
} from "@/agents/lib/permissions"
import { toolOutput, truncation } from "@/tools/lib/tool-output"

const MAX_OUTPUT_LENGTH = 30_000
const DEFAULT_TIMEOUT = 1 * 60 * 1000 // 1 minute
const MAX_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const SIGKILL_DELAY_MS = 200 // Wait before sending SIGKILL
const STREAM_THROTTLE_MS = 100 // Minimum time between streaming updates
const parserRequire = createRequire(import.meta.url)

/**
 * Detect the appropriate shell to use based on platform and environment
 */
function detectShell(): string | boolean {
	const envShell = process.env.SHELL

	// Use environment shell if available, but skip fish/nu (not POSIX compatible)
	if (envShell) {
		const unsupportedShells = new Set([
			"/bin/fish",
			"/bin/nu",
			"/usr/bin/fish",
			"/usr/bin/nu",
			"/usr/local/bin/fish",
			"/usr/local/bin/nu",
		])
		if (!unsupportedShells.has(envShell)) {
			return envShell
		}
	}

	// Platform-specific defaults
	if (process.platform === "darwin") {
		return "/bin/zsh"
	}

	if (process.platform === "win32") {
		return process.env.COMSPEC || "cmd.exe"
	}

	// Linux/other: try to find bash
	return "/bin/bash"
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Kill a process tree (process group on Unix, taskkill on Windows)
 */
async function killProcessTree(
	proc: ReturnType<typeof spawn>,
	exited: { value: boolean },
): Promise<void> {
	const pid = proc.pid
	if (!pid || exited.value) {
		return
	}

	if (process.platform === "win32") {
		// Windows: use taskkill to kill process tree
		await new Promise<void>((resolve) => {
			const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
				stdio: "ignore",
			})
			killer.once("exit", () => resolve())
			killer.once("error", () => resolve())
		})
		return
	}

	// Unix: kill process group with SIGTERM, then SIGKILL if needed
	try {
		// Try to kill the process group (negative PID)
		process.kill(-pid, "SIGTERM")
		await sleep(SIGKILL_DELAY_MS)

		if (!exited.value) {
			process.kill(-pid, "SIGKILL")
		}
	} catch {
		// Fallback: kill just the process if process group fails
		try {
			proc.kill("SIGTERM")
			await sleep(SIGKILL_DELAY_MS)

			if (!exited.value) {
				proc.kill("SIGKILL")
			}
		} catch {
			// Process already dead
		}
	}
}

const shell = detectShell()

interface ParsedCommand {
	text: string
	args: string[]
}

function parseToken(text: string): string {
	if (text === "-") return text
	if (text.startsWith("-")) {
		const idx = text.indexOf("=")
		if (idx > 0) return text.slice(0, idx)
		return text
	}
	return text
}

function isPathLike(text: string): boolean {
	if (text.length === 0) return false
	if (text === "." || text === ".." || text.startsWith("./") || text.startsWith("../")) return true
	if (path.isAbsolute(text)) return true
	if (text.startsWith("~")) return true
	if (text.includes(path.sep)) return true
	return false
}

function isPathCommand(cmd: string): boolean {
	return (
		cmd === "cd" ||
		cmd === "cat" ||
		cmd === "ls" ||
		cmd === "head" ||
		cmd === "tail" ||
		cmd === "stat" ||
		cmd === "find" ||
		cmd === "rg" ||
		cmd === "grep" ||
		cmd === "wc" ||
		cmd === "touch" ||
		cmd === "mkdir" ||
		cmd === "cp" ||
		cmd === "mv" ||
		cmd === "rm"
	)
}

function hasExternalPath(part: ParsedCommand, cwd: string): boolean {
	const cmd = part.args[0]
	if (!cmd || !isPathCommand(cmd)) return false
	for (const raw of part.args.slice(1)) {
		const token = parseToken(raw)
		if (token.startsWith("-")) continue
		if (!isPathLike(token)) continue
		const target = token.startsWith("~")
			? path.join(process.env.HOME || "", token.slice(1))
			: token
		const full = path.resolve(cwd, target)
		if (!full.startsWith(cwd)) return true
	}
	return false
}

function stripQuotes(text: string): string {
	if (text.length < 2) return text
	const first = text[0]
	const last = text[text.length - 1]
	if ((first === '"' || first === "'") && last === first) {
		return text.slice(1, -1)
	}
	return text
}

let parser: TsParser | undefined

async function initParser(): Promise<void> {
	if (parser) return
	const tree = await import("web-tree-sitter")
	const wasmPath = parserRequire.resolve("web-tree-sitter/tree-sitter.wasm")
	await tree.Parser.init({
		locateFile() {
			return wasmPath
		},
	})
	const langPath = parserRequire.resolve("tree-sitter-bash/tree-sitter-bash.wasm")
	const lang = await (tree as { Language: { load(path: string): Promise<unknown> } }).Language.load(langPath)
	const next = new tree.Parser()
	next.setLanguage(lang as never)
	parser = next
}

function parseByTreeSitter(input: string): ParsedCommand[] {
	if (!parser) return []
	const tree = parser.parse(input)
	if (!tree) return []
	const out: ParsedCommand[] = []
	for (const node of tree.rootNode.descendantsOfType("command")) {
		if (!node) continue
		const text =
			node.parent?.type === "redirected_statement" ? node.parent.text : node.text
		const args: string[] = []
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (!child) continue
			if (
				child.type !== "command_name" &&
				child.type !== "word" &&
				child.type !== "string" &&
				child.type !== "raw_string" &&
				child.type !== "concatenation"
			) {
				continue
			}
			args.push(stripQuotes(child.text))
		}
		if (args.length > 0) {
			out.push({ text, args })
		}
	}
	return out
}

function parseFallback(input: string): ParsedCommand[] {
	const parts = input
		.split(/&&|\|\||;|\|/g)
		.map((x) => x.trim())
		.filter(Boolean)
	const out: ParsedCommand[] = []
	for (const part of parts) {
		const args = part
			.split(/\s+/)
			.map((x) => stripQuotes(x))
			.filter(Boolean)
		if (args.length === 0) continue
		out.push({ text: part, args })
	}
	return out
}

function parseCommands(input: string): ParsedCommand[] {
	const parsed = parseByTreeSitter(input)
	if (parsed.length > 0) return parsed
	return parseFallback(input)
}

void initParser().catch(() => {})

function isSafeFind(args: string[]): boolean {
	const deny = new Set([
		"-exec",
		"-execdir",
		"-ok",
		"-okdir",
		"-delete",
		"-fls",
		"-fprint",
		"-fprint0",
		"-fprintf",
	])
	return !args.some((arg) => deny.has(arg))
}

function isSafeRg(args: string[]): boolean {
	return !args.some((arg) => {
		return (
			arg === "--search-zip" ||
			arg === "-z" ||
			arg === "--pre" ||
			arg.startsWith("--pre=") ||
			arg === "--hostname-bin" ||
			arg.startsWith("--hostname-bin=")
		)
	})
}

function isSafeGit(args: string[]): boolean {
	if (args.length === 0) return false
	if (args.some((arg) => arg === "-c" || arg.startsWith("-c") || arg === "--config-env" || arg.startsWith("--config-env="))) {
		return false
	}
	let sub = ""
	let idx = -1
	for (let i = 0; i < args.length; ) {
		const arg = args[i]!
		if (arg === "--") {
			const next = args[i + 1]
			if (!next) return false
			sub = next
			idx = i + 1
			break
		}
		if (
			arg === "-C" ||
			arg === "--git-dir" ||
			arg === "--work-tree" ||
			arg === "--namespace" ||
			arg === "--super-prefix" ||
			arg === "-c"
		) {
			i += 2
			continue
		}
		if (
			arg.startsWith("--git-dir=") ||
			arg.startsWith("--work-tree=") ||
			arg.startsWith("--namespace=") ||
			arg.startsWith("--super-prefix=") ||
			arg.startsWith("-c")
		) {
			i += 1
			continue
		}
		if (arg.startsWith("-")) {
			i += 1
			continue
		}
		sub = arg
		idx = i
		break
	}
	if (!sub) return false
	if (!["status", "log", "diff", "show", "branch"].includes(sub)) return false
	const rest = args.slice(idx + 1)
	if (
		rest.some(
			(arg) =>
				arg === "--output" ||
				arg.startsWith("--output=") ||
				arg === "--exec" ||
				arg.startsWith("--exec=") ||
				arg === "--ext-diff" ||
				arg === "--textconv" ||
				arg === "--paginate",
		)
	) {
		return false
	}
	if (sub !== "branch") return true
	if (rest.length === 0) return true
	return rest.every((arg) => {
		return (
			arg === "--list" ||
			arg === "-l" ||
			arg === "--show-current" ||
			arg === "-a" ||
			arg === "--all" ||
			arg === "-r" ||
			arg === "--remotes" ||
			arg === "-v" ||
			arg === "-vv" ||
			arg === "--verbose" ||
			arg.startsWith("--format=")
		)
	})
}

function hasUnsafeShellForm(command: string): boolean {
	if (
		command.includes(">") ||
		command.includes("<") ||
		command.includes("$(") ||
		command.includes("`")
	) {
		return true
	}
	if (command.includes("(") || command.includes(")")) {
		return true
	}
	return false
}

function getPermission(
	part: ParsedCommand,
	permissions: Record<string, Permission>,
): Permission {
	if (part.args.length === 0) {
		return checkPermission(part.text, permissions)
	}
	const cmd = part.args[0]!
	const line = part.args.join(" ")
	const first = part.args[1]
	const variants = [part.text, line, cmd]
	if (first && !first.startsWith("-")) {
		variants.push(`${cmd} ${first}*`)
		variants.push(`${cmd} ${first}`)
	}
	let allow = false
	for (const variant of variants) {
		const mode = checkPermission(variant, permissions)
		if (mode === "deny") return "deny"
		if (mode === "allow") allow = true
	}
	if (allow) return "allow"
	return "ask"
}

function isKnownSafeCommand(command: string): boolean {
	const allow = new Set([
		"cat",
		"cd",
		"cut",
		"echo",
		"expr",
		"false",
		"grep",
		"head",
		"id",
		"ls",
		"nl",
		"paste",
		"pwd",
		"rev",
		"seq",
		"stat",
		"tail",
		"tr",
		"true",
		"uname",
		"uniq",
		"wc",
		"which",
		"whoami",
	])

	for (const part of parseCommands(command)) {
		if (hasUnsafeShellForm(part.text)) {
			return false
		}
		const args = part.args
		const cmd = args[0]
		if (!cmd) return false
		if (allow.has(cmd)) continue
		if (cmd === "find") {
			if (!isSafeFind(args.slice(1))) return false
			continue
		}
		if (cmd === "rg") {
			if (!isSafeRg(args.slice(1))) return false
			continue
		}
		if (cmd === "git") {
			if (!isSafeGit(args.slice(1))) return false
			continue
		}
		return false
	}

	return true
}

const description = `Executes shell commands with real-time output streaming.

Usage:
- Commands are executed in the current working directory
- Output is streamed in real-time as it's produced
- Commands have a default timeout of 1 minute, maximum 10 minutes
- Output is truncated if it exceeds 30,000 characters
- Use this tool for running builds, tests, installations, git commands, etc.
- On timeout, processes are gracefully terminated (SIGTERM, then SIGKILL)`

const inputSchema = z.object({
	command: z.string().describe("The command to execute"),
	timeout: z.number().optional().describe("Optional timeout in milliseconds"),
	workdir: z
		.string()
		.optional()
		.describe(
			"The working directory to run the command in. Defaults to current working directory.",
		),
	description: z
		.string()
		.describe(
			"Clear, concise description of what this command does in 5-10 words",
		),
})

const outputSchema = toolOutput({
	pending: {
		command: z.string(),
		description: z.string(),
		output: z.undefined(),
	},
	streaming: {
		command: z.string(),
		description: z.string(),
		output: z.string(),
	},
	success: {
		command: z.string(),
		description: z.string(),
		output: z.string(),
		exitCode: z.number(),
		timedOut: z.boolean().optional(),
			...truncation,
	},
	error: {
		command: z.string(),
		description: z.string(),
	},
})

/**
 * Create a bash tool with custom permission patterns.
 *
 * @param permissions - Command pattern to permission mapping. Patterns support
 * wildcards (*) for matching. Default allows safe read-only commands.
 *
 * @example
 * // Allow read commands, ask for everything else
 * const bash = createBashTool({
 *   ...FILE_READ_COMMANDS,
 *   ...SEARCH_COMMANDS,
 *   "*": "ask",
 * })
 */
export function createBashTool(
	permissions: Record<string, Permission> = { "*": "ask" },
	opts: { safeAutoApprove?: boolean } = {},
) {
	return tool({
		description,
		inputSchema,
		outputSchema,
		needsApproval: ({ command }) => {
			const parsed = parseCommands(command)
			const parts = parsed.length > 0 ? parsed : [{ text: command, args: [] }]
			let ask = false
			const cwd = process.cwd()
			for (const part of parts) {
				const permission = getPermission(part, permissions)
				if (permission === "deny") {
					throw new PermissionDeniedError("bash", part.text)
				}
				if (permission === "ask") {
					ask = true
				}
				if (hasExternalPath(part, cwd)) {
					ask = true
				}
			}
			if (!ask) return false
			if (opts.safeAutoApprove && isKnownSafeCommand(command)) return false

			return ask
		},
		toModelOutput: ({ output }) => {
			if (output.status === "error") {
				return {
					type: "error-text",
					value: `Error executing "${output.command}": ${output.error}`,
				}
			}
			if (output.status === "success") {
				return { type: "text", value: output.output }
			}
			// For streaming/pending, don't send to model yet
			throw new Error("Invalid output status in toModelOutput")
		},
		async *execute({ command, timeout, description: desc, workdir }) {
			await initParser().catch(() => {})
			// Validate and constrain timeout
			if (timeout !== undefined && timeout < 0) {
				throw new Error(
					`Invalid timeout value: ${timeout}. Timeout must be a positive number.`,
				)
			}
			const effectiveTimeout = Math.min(timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)

			const cwd = workdir ? path.resolve(process.cwd(), workdir) : process.cwd()
			try {
				const stat = await fs.stat(cwd)
				if (!stat.isDirectory()) {
					throw new Error(`Working directory is not a directory: ${cwd}`)
				}
			} catch {
				throw new Error(`Working directory does not exist: ${cwd}`)
			}

			yield {
				status: "pending",
				message: `Running: ${command}`,
				command,
				description: desc,
				output: undefined,
			}

			// Use an async iterator pattern with events
			const proc = spawn(command, {
				shell,
				cwd,
				env: process.env,
				stdio: ["ignore", "pipe", "pipe"],
				// Detach on Unix to create process group for clean killing
				detached: process.platform !== "win32",
			})

			let output = ""
			let timedOut = false
			const exited = { value: false }
			let lastStreamTime = 0

			// Create a queue for streaming updates
			const streamQueue: string[] = []
			let resolveStream: (() => void) | null = null

			const queueStreamUpdate = () => {
				const now = Date.now()
				// Throttle updates to avoid overwhelming
				if (now - lastStreamTime >= STREAM_THROTTLE_MS) {
					lastStreamTime = now
					streamQueue.push(output)
					if (resolveStream) {
						resolveStream()
						resolveStream = null
					}
				}
			}

			// Capture stdout
			proc.stdout?.on("data", (chunk: Buffer) => {
				output += chunk.toString()
				queueStreamUpdate()
			})

			// Capture stderr
			proc.stderr?.on("data", (chunk: Buffer) => {
				output += chunk.toString()
				queueStreamUpdate()
			})

			// Set up timeout
			const timeoutTimer = setTimeout(() => {
				timedOut = true
				void killProcessTree(proc, exited)
			}, effectiveTimeout)

			// Create promise for process completion
			const exitPromise = new Promise<number | null>((resolve, reject) => {
				proc.once("close", (code) => {
					exited.value = true
					clearTimeout(timeoutTimer)
					// Signal any pending stream wait
					if (resolveStream) {
						resolveStream()
						resolveStream = null
					}
					resolve(code)
				})

				proc.once("error", (error) => {
					exited.value = true
					clearTimeout(timeoutTimer)
					if (resolveStream) {
						resolveStream()
						resolveStream = null
					}
					reject(new Error(`Failed to execute command: ${error.message}`))
				})
			})

			// Stream output while process is running
			try {
				while (!exited.value) {
					// Wait for either new output or process exit
					await Promise.race([
						new Promise<void>((resolve) => {
							resolveStream = resolve
						}),
						exitPromise.catch(() => {}), // Don't throw here, handle below
						sleep(STREAM_THROTTLE_MS * 2), // Fallback timeout
					])

					// Yield streaming update if we have new output
					if (streamQueue.length > 0) {
						const latestOutput = streamQueue[streamQueue.length - 1]!
						streamQueue.length = 0 // Clear queue

						// Only yield if we have actual content
						if (latestOutput.length > 0) {
							yield {
								status: "streaming",
								message: `Running: ${command}`,
								command,
								description: desc,
								output: latestOutput,
							}
						}
					}
				}

				// Wait for exit and get code
				const exitCode = await exitPromise

				// Truncate output if too long
				let truncated = false
				if (output.length > MAX_OUTPUT_LENGTH) {
					output = output.slice(0, MAX_OUTPUT_LENGTH)
					output += "\n\n(Output was truncated due to length limit)"
					truncated = true
				}

				// Add timeout notice
				if (timedOut) {
					output += `\n\n(Command timed out after ${effectiveTimeout}ms)`
				}

				yield {
					status: "success",
					message: `Command completed with exit code ${exitCode ?? -1}`,
					command,
					description: desc,
					output: `Command: ${command}\nDescription: ${desc}\nExit code: ${exitCode ?? -1}\n\n${output}`,
					exitCode: exitCode ?? -1,
					timedOut: timedOut || undefined,
					truncated: truncated || undefined,
					truncationReason: truncated ? "output_limit" : undefined,
				}
			} catch (error) {
				yield {
					status: "error",
					message: `Failed to execute: ${command}`,
					command,
					description: desc,
					error: error instanceof Error ? error.message : String(error),
				}
			}
		},
	})
}

/**
 * Default bash tool with standard permissions.
 * Safe read-only commands are auto-allowed, others require approval.
 */
export const bashTool = createBashTool()
