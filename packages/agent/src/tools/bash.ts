import { tool } from "ai"
import { spawn } from "child_process"
import { z } from "zod"
import { toolOutput } from "./tool-utils"

const MAX_OUTPUT_LENGTH = 30_000
const DEFAULT_TIMEOUT = 1 * 60 * 1000 // 1 minute
const MAX_TIMEOUT = 10 * 60 * 1000 // 10 minutes

export const bashTool = tool({
	description: `Executes shell commands in bash.

Usage:
- Commands are executed in the current working directory
- Output is captured from both stdout and stderr
- Commands have a default timeout of 1 minute, maximum 10 minutes
- Output is truncated if it exceeds 30,000 characters
- Use this tool for running builds, tests, installations, git commands, etc.`,
	needsApproval: true,
	inputSchema: z.object({
		command: z.string().describe("The command to execute"),
		timeout: z.number().optional().describe("Optional timeout in milliseconds"),
		description: z
			.string()
			.describe(
				"Clear, concise description of what this command does in 5-10 words",
			),
	}),
	outputSchema: toolOutput({
		pending: {
			command: z.string(),
			description: z.string(),
			output: z.undefined(),
		},
		success: {
			command: z.string(),
			description: z.string(),
			output: z.string(),
			exitCode: z.number(),
		},
		error: {
			command: z.string(),
			description: z.string(),
		},
	}),
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
		throw new Error("Invalid output status in toModelOutput")
	},
	async *execute({ command, timeout = DEFAULT_TIMEOUT, description }) {
		const effectiveTimeout = Math.min(timeout, MAX_TIMEOUT)

		yield {
			status: "pending",
			message: `Running: ${command}`,
			command,
			description,
			output: undefined,
		}

		try {
			const result = await new Promise<{
				output: string
				exitCode: number
			}>((resolve, reject) => {
				const childProcess = spawn(command, {
					shell: true,
					cwd: process.cwd(),
					stdio: ["ignore", "pipe", "pipe"],
					timeout: effectiveTimeout,
				})

				let output = ""

				childProcess.stdout?.on("data", (chunk) => {
					output += chunk.toString()
				})

				childProcess.stderr?.on("data", (chunk) => {
					output += chunk.toString()
				})

				childProcess.on("close", (code) => {
					if (output.length > MAX_OUTPUT_LENGTH) {
						output = output.slice(0, MAX_OUTPUT_LENGTH)
						output += "\n\n(Output was truncated due to length limit)"
					}

					if (childProcess.signalCode === "SIGTERM") {
						output += `\n\n(Command timed out after ${effectiveTimeout} ms)`
					}

					resolve({
						output: `Command: ${command}\nDescription: ${description}\nExit code: ${code}\n\n${output}`,
						exitCode: code ?? -1,
					})
				})

				childProcess.on("error", (error) => {
					reject(new Error(`Failed to execute command: ${error.message}`))
				})
			})

			yield {
				status: "success",
				message: `Command completed with exit code ${result.exitCode}`,
				command,
				description,
				output: result.output,
				exitCode: result.exitCode,
			}
		} catch (error) {
			yield {
				status: "error",
				message: `Failed to execute: ${command}`,
				command,
				description,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	},
})
