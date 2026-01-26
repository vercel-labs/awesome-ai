import { describe, expect, test } from "bun:test"
import { Dialog, DialogText, DialogTitle } from "../../src/components/ui/dialog"
import { getBufferText, renderTui } from "../helpers/render"

describe("Dialog", () => {
	test("renders title and text", async () => {
		const result = await renderTui(
			<Dialog>
				<DialogTitle>Example</DialogTitle>
				<DialogText>Body text</DialogText>
			</Dialog>,
		)
		const output = getBufferText(result)
		expect(output).toContain("Example")
		expect(output).toContain("Body text")
	})
})
