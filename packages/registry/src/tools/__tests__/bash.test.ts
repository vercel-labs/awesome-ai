import { assert, describe, expect, it } from "vitest"
import { promises as fs } from "fs"
import * as os from "os"
import * as path from "path"
import { PermissionDeniedError } from "@/agents/lib/permissions"
import { bashTool, createBashTool } from "../bash"
import { executeTool } from "./lib/test-utils"

describe("bashTool", () => {
	it("executes a simple command", async () => {
		const results = await executeTool(bashTool, {
			command: "echo hello",
			description: "Print hello",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
			exitCode: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain("hello")
		expect(finalResult?.exitCode).toBe(0)
	})

	it("captures exit code for failed commands", async () => {
		const results = await executeTool(bashTool, {
			command: "exit 42",
			description: "Exit with code 42",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			exitCode: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.exitCode).toBe(42)
	})

	it("captures stdout", async () => {
		const results = await executeTool(bashTool, {
			command: "echo 'stdout output'",
			description: "Print to stdout",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain("stdout output")
	})

	it("captures stderr", async () => {
		const results = await executeTool(bashTool, {
			command: "echo 'stderr output' >&2",
			description: "Print to stderr",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain("stderr output")
	})

	it("captures both stdout and stderr", async () => {
		const results = await executeTool(bashTool, {
			command: "echo 'out' && echo 'err' >&2",
			description: "Print to both streams",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain("out")
		expect(finalResult?.output).toContain("err")
	})

	it("yields pending status before completion", async () => {
		const results = await executeTool(bashTool, {
			command: "echo test",
			description: "Test pending",
		})

		expect(results.length).toBeGreaterThanOrEqual(2)
		const pendingResult = results[0] as { status: string }
		expect(pendingResult?.status).toBe("pending")
	})

	it("includes command and description in output", async () => {
		const results = await executeTool(bashTool, {
			command: "echo test",
			description: "Test description",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
			command: string
			description: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.command).toBe("echo test")
		expect(finalResult?.description).toBe("Test description")
		expect(finalResult?.output).toContain("Command: echo test")
		expect(finalResult?.output).toContain("Description: Test description")
	})

	it("handles commands with special characters", async () => {
		const results = await executeTool(bashTool, {
			command: "echo 'hello \"world\"'",
			description: "Print with quotes",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain('hello "world"')
	})

	it("handles multiline output", async () => {
		const results = await executeTool(bashTool, {
			command: "echo 'line1' && echo 'line2' && echo 'line3'",
			description: "Print multiple lines",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain("line1")
		expect(finalResult?.output).toContain("line2")
		expect(finalResult?.output).toContain("line3")
	})

	it("handles empty output", async () => {
		const results = await executeTool(bashTool, {
			command: "true",
			description: "No output command",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			exitCode: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.exitCode).toBe(0)
	})

	it("handles command not found", async () => {
		const results = await executeTool(bashTool, {
			command: "nonexistent_command_12345",
			description: "Run nonexistent command",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			exitCode: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.exitCode).not.toBe(0)
	})

	it("times out long-running commands", async () => {
		const results = await executeTool(bashTool, {
			command: "sleep 10",
			timeout: 100, // 100ms timeout
			description: "Sleep that should timeout",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			timedOut?: boolean
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.timedOut).toBe(true)
		expect(finalResult?.output).toContain("timed out")
	}, 5000)

	it("uses custom timeout when provided", async () => {
		const start = Date.now()

		const results = await executeTool(bashTool, {
			command: "sleep 5",
			timeout: 200,
			description: "Test custom timeout",
		})

		const elapsed = Date.now() - start

		const finalResult = results[results.length - 1] as {
			status: string
			timedOut?: boolean
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.timedOut).toBe(true)
		// Should timeout around 200ms, not 5000ms
		expect(elapsed).toBeLessThan(1000)
	}, 5000)

	it("handles environment variables", async () => {
		const results = await executeTool(bashTool, {
			command: "echo $HOME",
			description: "Print HOME env var",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		// HOME should be expanded to actual path
		expect(finalResult?.output).toContain(process.env.HOME ?? "/")
	})

	it("runs in current working directory", async () => {
		const results = await executeTool(bashTool, {
			command: "pwd",
			description: "Print working directory",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain(process.cwd())
	})

	it("runs in provided working directory", async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bash-workdir-"))
		await fs.writeFile(path.join(dir, "x.txt"), "x", "utf-8")
		const results = await executeTool(bashTool, {
			command: "pwd",
			workdir: dir,
			description: "Print working directory from custom location",
		})
		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain(dir)
		await fs.rm(dir, { recursive: true, force: true })
	})

	it("handles piped commands", async () => {
		const results = await executeTool(bashTool, {
			command: "echo 'hello world' | tr 'a-z' 'A-Z'",
			description: "Pipe echo to tr",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.output).toContain("HELLO WORLD")
	})

	it("includes exit code in output message", async () => {
		const results = await executeTool(bashTool, {
			command: "exit 5",
			description: "Exit with specific code",
		})

		const finalResult = results[results.length - 1] as {
			status: string
			output: string
			exitCode: number
		}
		expect(finalResult?.status).toBe("success")
		expect(finalResult?.exitCode).toBe(5)
		expect(finalResult?.output).toContain("Exit code: 5")
	})

	it("reports truncation metadata for large output", async () => {
		const results = await executeTool(bashTool, {
			command: "seq 1 20000",
			description: "Produce long output",
		})
		const finalResult = results[results.length - 1] as {
			status: string
			truncated?: boolean
			truncationReason?: string
		}
		expect(finalResult.status).toBe("success")
		expect(finalResult.truncated).toBe(true)
		expect(finalResult.truncationReason).toBe("output_limit")
	}, 10000)

	it("yields streaming output for long-running commands", async () => {
		// Command that produces output with delays to trigger streaming
		const results = await executeTool(bashTool, {
			command:
				"echo 'first' && sleep 0.2 && echo 'second' && sleep 0.2 && echo 'third'",
			description: "Streaming output test",
		})

		// Should have pending, possibly streaming, and success
		const statuses = results.map((r) => (r as { status: string }).status)

		expect(statuses[0]).toBe("pending")
		expect(statuses[statuses.length - 1]).toBe("success")

		// Check for streaming results (may or may not appear depending on timing)
		const streamingResults = results.filter(
			(r) => (r as { status: string }).status === "streaming",
		)

		// If we got streaming results, verify they have partial output
		if (streamingResults.length > 0) {
			const firstStreaming = streamingResults[0] as { output: string }
			expect(firstStreaming.output).toBeDefined()
		}

		// Final result should have all output
		const finalResult = results[results.length - 1] as { output: string }
		expect(finalResult.output).toContain("first")
		expect(finalResult.output).toContain("second")
		expect(finalResult.output).toContain("third")
	}, 5000)

	it("defaults to requiring approval for all commands", () => {
		const { needsApproval } = bashTool
		assert(typeof needsApproval === "function")

		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval({ command: "echo hello", description: "" }, opts),
		).toBe(true)
		expect(needsApproval({ command: "ls", description: "" }, opts)).toBe(true)
	})

	it("respects custom permissions", () => {
		const bash = createBashTool({
			"echo*": "allow",
			"rm*": "deny",
			"*": "ask",
		})

		const { needsApproval } = bash
		assert(typeof needsApproval === "function")

		const opts = { toolCallId: "test", messages: [] }

		// Allowed command
		expect(
			needsApproval({ command: "echo hello", description: "" }, opts),
		).toBe(false)

		// Ask command
		expect(needsApproval({ command: "cat file", description: "" }, opts)).toBe(
			true,
		)

		// Denied command
		expect(() =>
			needsApproval({ command: "rm -rf /", description: "" }, opts),
		).toThrow(PermissionDeniedError)
	})

	it("auto-approves known-safe commands when enabled", () => {
		const bash = createBashTool({ "*": "ask" }, { safeAutoApprove: true })
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(needsApproval({ command: "ls", description: "" }, opts)).toBe(false)
		expect(
			needsApproval({ command: "rg --search-zip test", description: "" }, opts),
		).toBe(true)
	})

	it("checks permissions per parsed command segment", () => {
		const bash = createBashTool({
			"ls*": "allow",
			"git status*": "allow",
			"*": "ask",
		})
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval({ command: "ls && git status", description: "" }, opts),
		).toBe(false)
	})

	it("requires approval for path-like arguments outside cwd", () => {
		const bash = createBashTool({ "cat*": "allow", "*": "ask" })
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval({ command: "cat ../../etc/hosts", description: "" }, opts),
		).toBe(true)
	})

	it("does not auto-approve nested shell forms", () => {
		const bash = createBashTool({ "*": "ask" }, { safeAutoApprove: true })
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval({ command: "echo $(pwd)", description: "" }, opts),
		).toBe(true)
		expect(
			needsApproval({ command: "echo (hello)", description: "" }, opts),
		).toBe(true)
	})

	it("allows safe git global options during auto-approval", () => {
		const bash = createBashTool({ "*": "ask" }, { safeAutoApprove: true })
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval(
				{ command: "git -C . branch --show-current", description: "" },
				opts,
			),
		).toBe(false)
	})

	it("prefers specific allow over broader ask patterns", () => {
		const bash = createBashTool({
			"git status*": "allow",
			"git *": "ask",
			"*": "ask",
		})
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval(
				{ command: "git status --short", description: "" },
				opts,
			),
		).toBe(false)
	})

	it("treats specific arg variants as distinct from base command", () => {
		const bash = createBashTool({
			"git status --short": "allow",
			"*": "ask",
		})
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(
			needsApproval(
				{ command: "git status --short", description: "" },
				opts,
			),
		).toBe(false)
		expect(needsApproval({ command: "git status", description: "" }, opts)).toBe(
			true,
		)
	})

	it("applies deny when a specific variant is denied", () => {
		const bash = createBashTool({
			"git status*": "deny",
			"git *": "allow",
			"*": "ask",
		})
		const { needsApproval } = bash
		assert(typeof needsApproval === "function")
		const opts = { toolCallId: "test", messages: [] }
		expect(() =>
			needsApproval({ command: "git status --short", description: "" }, opts),
		).toThrow(PermissionDeniedError)
	})
})
