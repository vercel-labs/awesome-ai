import { describe, expect, test } from "bun:test"
import { ThinkingSection } from "../../src/components/thinking-section"
import { getBufferText, renderTui } from "../helpers/render"

describe("ThinkingSection", () => {
	test("shows preview and expand hint when collapsed", async () => {
		const thinking = "Line one\nLine two\nLine three"
		const result = await renderTui(<ThinkingSection thinking={thinking} />)
		const output = getBufferText(result)
		expect(output).toContain("thinking")
		expect(output).toContain("Line one")
		expect(output).toContain("click to expand")
	})
})
