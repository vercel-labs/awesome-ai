import { describe, expect, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { Footer } from "../../src/components/footer"
import { Header } from "../../src/components/header"
import { getBufferText, renderTui } from "../helpers/render"

describe("Header/Footer", () => {
	test("header shows agent name and shortcuts hint", async () => {
		const result = await renderTui(<Header agentName="alpha" />)
		const output = getBufferText(result)
		expect(output).toContain("alpha")
		expect(output).toContain("shortcuts")
	})

	test("footer shows model and debug status", async () => {
		const store = createAppStore({
			selectedModel: "model-x",
			showDebug: true,
		})
		const result = await renderTui(<Footer />, { store })
		const output = getBufferText(result)
		expect(output).toContain("model-x")
		expect(output).toContain("debug on")
	})
})
