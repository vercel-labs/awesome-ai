import { describe, expect, test } from "bun:test"
import { createAppStore } from "../../src/components/atoms"
import { createUserMessage } from "../../src/types"

describe("App store actions", () => {
	test("add, set, and clear messages", () => {
		const store = createAppStore()
		store.actions.addMessage(createUserMessage("hello"))
		expect(store.atoms.messagesAtom.get().length).toBe(1)

		store.actions.setMessages([createUserMessage("a"), createUserMessage("b")])
		expect(store.atoms.messagesAtom.get().length).toBe(2)

		store.actions.clearMessages()
		expect(store.atoms.messagesAtom.get().length).toBe(0)
	})

	test("alerts are added and dismissed", () => {
		const store = createAppStore()
		const id = store.actions.showAlert("saved", "success", 5)
		expect(store.atoms.alertsAtom.get().some((a) => a.id === id)).toBe(true)

		store.actions.dismissAlert(id)
		expect(store.atoms.alertsAtom.get().some((a) => a.id === id)).toBe(false)
	})
})
