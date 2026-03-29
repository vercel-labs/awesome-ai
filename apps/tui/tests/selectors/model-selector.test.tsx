import { describe, expect, mock, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { ModelSelector, useModelSelectorKeyHandler } from "../../src/components/model-selector"
import { makeKeyEvent } from "../helpers/keys"
import { getBufferText, renderTui } from "../helpers/render"

mock.module("../../src/utils/models", () => ({
	useFetchAvailableModels: () => () => Promise.resolve([]),
	isUsingFallbackModels: () => false,
}))

mock.module("../../src/utils/settings", () => ({
	saveWorkspaceSettings: () => Promise.resolve(),
}))

describe("ModelSelector", () => {
	test("shows loading state", async () => {
		const store = createAppStore({ isLoadingModels: true })
		const result = await renderTui(<ModelSelector />, { store })
		const output = getBufferText(result)
		expect(output).toContain("Loading available models")
	})

	test("renders model list", async () => {
		const store = createAppStore({
			availableModels: [
				{ id: "a/alpha", name: "Alpha", provider: "a" },
				{ id: "b/beta", name: "Beta", provider: "b" },
			],
			selectedModel: "a/alpha",
		})
		const result = await renderTui(<ModelSelector />, { store })
		const output = getBufferText(result)
		expect(output).toContain("Alpha")
		expect(output).toContain("Current:")
	})

	test("key handler selects model and closes", async () => {
		const store = createAppStore({
			showModelSelector: true,
			availableModels: [
				{ id: "a/alpha", name: "Alpha", provider: "a" },
				{ id: "b/beta", name: "Beta", provider: "b" },
			],
		})

		let handler: ((key: any) => boolean) | null = null
		const HandlerProbe = () => {
			handler = useModelSelectorKeyHandler()
			return null
		}

		await renderTui(<HandlerProbe />, { store })

		handler?.(makeKeyEvent({ name: "down" }))
		expect(store.atoms.selectedModelIndexAtom.get()).toBe(1)

		handler?.(makeKeyEvent({ name: "return" }))
		expect(store.atoms.selectedModelAtom.get()).toBe("b/beta")
		expect(store.atoms.showModelSelectorAtom.get()).toBe(false)
	})
})
