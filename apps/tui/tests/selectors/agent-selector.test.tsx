import { describe, expect, mock, test } from "bun:test"
import {
	AgentSelector,
	useAgentSelectorKeyHandler,
} from "../../src/components/agent-selector"
import { createAppStore } from "../../src/components/atoms"
import { makeKeyEvent } from "../helpers/keys"
import { getBufferText, renderTui } from "../helpers/render"

mock.module("../../src/utils/settings", () => ({
	saveWorkspaceSettings: () => Promise.resolve(),
}))

describe("AgentSelector", () => {
	test("shows empty state when no agents", async () => {
		const store = createAppStore({ availableAgents: [] })
		const result = await renderTui(<AgentSelector />, { store })
		const output = getBufferText(result)
		expect(output).toContain("No agents found")
	})

	test("renders agent list and current agent", async () => {
		const store = createAppStore({
			availableAgents: [
				{ name: "alpha", path: "/tmp/alpha.ts" },
				{ name: "beta", path: "/tmp/beta.ts" },
			],
			currentAgent: "alpha",
		})
		const result = await renderTui(<AgentSelector />, { store })
		const output = getBufferText(result)
		expect(output).toContain("alpha")
		expect(output).toContain("beta")
		expect(output).toContain("Current:")
	})

	test("key handler updates selection and closes", async () => {
		const store = createAppStore({
			showAgentSelector: true,
			availableAgents: [
				{ name: "alpha", path: "/tmp/alpha.ts" },
				{ name: "beta", path: "/tmp/beta.ts" },
			],
		})

		let handler: ((key: any) => boolean) | null = null

		const HandlerProbe = () => {
			handler = useAgentSelectorKeyHandler()
			return null
		}

		await renderTui(<HandlerProbe />, { store })

		handler?.(makeKeyEvent({ name: "down" }))
		expect(store.atoms.selectedAgentIndexAtom.get()).toBe(1)

		handler?.(makeKeyEvent({ name: "return" }))
		expect(store.atoms.currentAgentAtom.get()).toBe("beta")
		expect(store.atoms.showAgentSelectorAtom.get()).toBe(false)
	})
})
