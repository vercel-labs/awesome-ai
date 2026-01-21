import { describe, expect, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { AlertContainer } from "../../src/components/ui/alert"
import { getBufferText, renderTui } from "../helpers/render"

describe("AlertContainer", () => {
	test("renders alert messages", async () => {
		const store = createAppStore({
			alerts: [
				{ id: "a1", message: "Saved", type: "success" },
				{ id: "a2", message: "Failed", type: "error" },
			],
		})
		const result = await renderTui(<AlertContainer />, { store })
		const output = getBufferText(result)
		expect(output).toContain("Saved")
		expect(output).toContain("Failed")
	})
})
