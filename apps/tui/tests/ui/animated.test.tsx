import { describe, expect, test } from "bun:test"
import { AnimatedDots } from "../../src/components/ui/animated-dots"
import { Spinner } from "../../src/components/ui/spinner"
import { ThinkingDots } from "../../src/components/ui/thinking-dots"
import { getBufferText, renderTui } from "../helpers/render"

describe("Animated UI", () => {
	test("animated dots show label", async () => {
		const result = await renderTui(<AnimatedDots label="Generating" />)
		const output = getBufferText(result)
		expect(output).toContain("Generating")
	})

	test("spinner renders first frame", async () => {
		const result = await renderTui(<Spinner />)
		const output = getBufferText(result)
		expect(output).toContain("⠋")
	})

	test("thinking dots render label", async () => {
		const result = await renderTui(<ThinkingDots />)
		const output = getBufferText(result)
		expect(output).toContain("thinking")
	})
})
