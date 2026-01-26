import { createTestRenderer } from "@opentui/core/testing"
import { createRoot, flushSync } from "@opentui/react"
import { afterEach } from "bun:test"
import type { ReactNode } from "react"
import { AppAtomsProvider, createAppStore } from "../../src/components/atoms"

export interface RenderOptions {
	columns?: number
	rows?: number
	store?: ReturnType<typeof createAppStore>
}

const activeRenderers = new Set<{ destroy: () => void }>()

afterEach(() => {
	for (const renderer of activeRenderers) {
		renderer.destroy()
	}
	activeRenderers.clear()
})

export async function renderTui(node: ReactNode, options: RenderOptions = {}) {
	const { columns = 80, rows = 24, store = createAppStore() } = options
	const testHarness = await createTestRenderer({
		width: columns,
		height: rows,
	})
	const { renderer, renderOnce, captureCharFrame } = testHarness
	const root = createRoot(renderer)

	activeRenderers.add(renderer)

	flushSync(() => {
		root.render(<AppAtomsProvider atoms={store.atoms}>{node}</AppAtomsProvider>)
	})
	await renderOnce()

	return { renderer, store, renderOnce, captureCharFrame }
}

export function getBufferText(target: unknown): string {
	const anyTarget = target as {
		captureCharFrame?: () => string
		getBufferText?: () => string
		getBuffer?: () => { toString?: () => string }
		buffer?: { toString?: () => string }
	}

	if (typeof anyTarget.captureCharFrame === "function") {
		return anyTarget.captureCharFrame()
	}

	if (typeof anyTarget.getBufferText === "function") {
		return anyTarget.getBufferText()
	}

	const buffer = anyTarget.getBuffer?.() ?? anyTarget.buffer
	if (buffer?.toString) {
		return buffer.toString()
	}

	return ""
}
