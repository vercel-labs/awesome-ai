import { describe, expect, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { DebugOverlay } from "../../src/components/debug-overlay"
import { getBufferText, renderTui } from "../helpers/render"

describe("DebugOverlay", () => {
	test("renders empty state", async () => {
		const store = createAppStore({ debugLogs: [] })
		const result = await renderTui(<DebugOverlay />, { store })
		const output = getBufferText(result)
		expect(output).toContain("Debug Console")
		expect(output).toContain("No logs yet")
	})

	test("renders log lines", async () => {
		const store = createAppStore({ debugLogs: ["log-1", "log-2"] })
		const result = await renderTui(<DebugOverlay />, { store })
		const output = getBufferText(result)
		expect(output).toContain("log-1")
		expect(output).toContain("log-2")
	})
})
