import { describe, expect, it } from "vitest"
import { bashTool } from "../bash"
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
})
