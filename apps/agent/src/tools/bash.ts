import { tool } from "ai"
import { spawn } from "child_process"
import { z } from "zod"
import {
	checkPermission,
	type Permission,
	PermissionDeniedError,
} from "@/agents/lib/permissions"
import { toolOutput } from "@/tools/lib/tool-output"

const MAX_OUTPUT_LENGTH = 30_000
const DEFAULT_TIMEOUT = 1 * 60 * 1000 // 1 minute
const MAX_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const SIGKILL_DELAY_MS = 200 // Wait before sending SIGKILL
const STREAM_THROTTLE_MS = 100 // Minimum time between streaming updates

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
) {
	return tool({
		description,
		inputSchema,
		outputSchema,
		needsApproval: ({ command }) => {
			const permission = checkPermission(command, permissions)

			if (permission === "deny") {
				throw new PermissionDeniedError("bash", command)
			}

			// Return true if approval needed (ask), false if auto-allowed
			return permission === "ask"
		},
		toModelOutput: (output) => {
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
		async *execute({ command, timeout, description: desc }) {
			// Validate and constrain timeout
			if (timeout !== undefined && timeout < 0) {
				throw new Error(
					`Invalid timeout value: ${timeout}. Timeout must be a positive number.`,
				)
			}
			const effectiveTimeout = Math.min(timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)

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
				cwd: process.cwd(),
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
				if (output.length > MAX_OUTPUT_LENGTH) {
					output = output.slice(0, MAX_OUTPUT_LENGTH)
					output += "\n\n(Output was truncated due to length limit)"
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
