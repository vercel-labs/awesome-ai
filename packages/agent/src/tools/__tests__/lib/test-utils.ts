import type { Tool } from "ai"

/**
 * Execute a tool and collect all yielded results.
 * Handles both async iterables and promise-based returns.
 */
export async function executeTool<T extends Tool>(
	tool: T,
	input: Parameters<NonNullable<T["execute"]>>[0],
) {
	const toolCallOptions = {
		toolCallId: "test-call-id",
		messages: [],
	}
	const result = tool.execute!(input, toolCallOptions)
	const results: unknown[] = []
	if (Symbol.asyncIterator in Object(result)) {
		for await (const r of result as AsyncIterable<unknown>) {
			results.push(r)
		}
	} else {
		results.push(await result)
	}
	return results
}

