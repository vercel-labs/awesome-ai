import { describe, expect, test } from "bun:test"
import { CodeBlock } from "../../src/components/code-block"
import { getBufferText, renderTui } from "../helpers/render"

describe("CodeBlock", () => {
	test("renders code content with line numbers", async () => {
		const code = ["const a = 1", "const b = 2"].join("\n")
		const result = await renderTui(<CodeBlock code={code} language="ts" />)
		const output = getBufferText(result)
		expect(output).toContain("const a = 1")
		expect(output).toContain("const b = 2")
		expect(output).toContain("1 │")
	})
})
