import { describe, expect, test } from "bun:test"
import {
	formatTimestamp,
	getToolError,
	getToolMessage,
	getToolStatus,
} from "../../src/types"

describe("types helpers", () => {
	test("formatTimestamp uses 24h format", () => {
		const ts = new Date("2024-01-01T13:05:00Z").getTime()
		const formatted = formatTimestamp(ts)
		expect(formatted.startsWith("[")).toBe(true)
	})

	test("extracts tool message, status, and error", () => {
		const output = { status: "error", message: "Failed", error: "Boom" }
		expect(getToolMessage(output)).toBe("Failed")
		expect(getToolStatus(output)).toBe("error")
		expect(getToolError(output)).toBe("Boom")
	})
})
