import { describe, expect, test } from "bun:test"
import { Markdown } from "../../src/components/markdown"
import { getBufferText, renderTui } from "../helpers/render"

describe("Markdown", () => {
	test("renders headings, lists, and code", async () => {
		const content = [
			"# Title",
			"",
			"- Item one",
			"- Item two",
			"",
			"```ts",
			"const x = 1",
			"```",
		].join("\n")

		const result = await renderTui(<Markdown>{content}</Markdown>)
		const output = getBufferText(result)
		expect(output).toContain("Title")
		expect(output).toContain("Item one")
		expect(output).toContain("const x = 1")
	})
})
