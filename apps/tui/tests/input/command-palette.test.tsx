import { describe, expect, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { CommandPalette } from "../../src/components/command-palette"
import { getBufferText, renderTui } from "../helpers/render"

describe("CommandPalette", () => {
	test("renders filtered commands", async () => {
		const store = createAppStore({
			showCommands: true,
			commandFilter: "/hi",
			selectedCommand: 0,
		})

		const result = await renderTui(<CommandPalette />, { store })
		const output = getBufferText(result)
		expect(output).toContain("/history")
	})
})
