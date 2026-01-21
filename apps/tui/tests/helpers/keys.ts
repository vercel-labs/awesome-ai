import type { KeyEvent } from "@opentui/core"

export function makeKeyEvent(overrides: Partial<KeyEvent>): KeyEvent {
	return {
		name: "",
		ctrl: false,
		meta: false,
		option: false,
		shift: false,
		preventDefault() {},
		stopPropagation() {},
		...overrides,
	}
}
