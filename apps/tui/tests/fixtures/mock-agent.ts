import type { ModelMessage } from "ai"

const mockAgent = {
	version: "agent-v1",
	stream: async () => {
		async function* fullStream() {
			yield* []
		}

		return {
			fullStream: fullStream(),
			response: Promise.resolve({ messages: [] as ModelMessage[] }),
		}
	},
}

export default mockAgent
