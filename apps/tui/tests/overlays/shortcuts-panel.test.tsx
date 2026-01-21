import { describe, expect, test } from "bun:test"
import { ShortcutsPanel } from "../../src/components/shortcuts-panel"
import { getBufferText, renderTui } from "../helpers/render"

describe("ShortcutsPanel", () => {
	test("renders shortcuts sections", async () => {
		const result = await renderTui(<ShortcutsPanel />)
		const output = getBufferText(result)
		expect(output).toContain("COMMANDS")
		expect(output).toContain("/help")
	})
})
